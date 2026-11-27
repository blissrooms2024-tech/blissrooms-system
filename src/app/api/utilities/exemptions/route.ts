import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { withActivity } from "@/lib/activity";
import { fmtDate } from "@/lib/format";
import { exemptionSchema } from "@/lib/utilitySchemas";
import { KIND_LABELS, type UtilityKind } from "@/lib/utilitySplit";

/** POST /api/utilities/exemptions — a tenant doesn't pay some usage charges for a while, and
 * why. The company pays their share instead (Admin). */
async function handlePOST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ success: false, message: "只有 Admin 可以设豁免" }, { status: 403 });
  const parsed = exemptionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const reasonMissing = parsed.error.issues.some((i) => i.path[0] === "reason");
    return NextResponse.json({ success: false, message: reasonMissing ? "请写豁免的原因" : "豁免资料不完整" }, { status: 400 });
  }
  const d = parsed.data;
  if (d.endDate && d.endDate < d.startDate) return NextResponse.json({ success: false, message: "结束日期不能早过开始日期" }, { status: 400 });
  const contract = await prisma.contract.findUnique({ where: { contractCode: d.contractCode }, select: { id: true, contractCode: true, tenantName: true } });
  if (!contract) return NextResponse.json({ success: false, message: "找不到合同" }, { status: 404 });

  await prisma.utilityExemption.createMany({
    data: d.kinds.map((kind) => ({
      contractId: contract.id,
      kind,
      startDate: new Date(`${d.startDate}T00:00:00.000Z`),
      endDate: d.endDate ? new Date(`${d.endDate}T00:00:00.000Z`) : null,
      reason: d.reason,
      createdBy: user.name,
    })),
  });
  const what = d.kinds.map((k) => KIND_LABELS[k as UtilityKind].zh).join("、");
  const until = d.endDate ? `到 ${fmtDate(d.endDate)}` : "到合约结束";
  return NextResponse.json({ success: true, message: `${contract.contractCode} ${contract.tenantName} 豁免${what}，${until}（原因：${d.reason}）` });
}

export const POST = withActivity(handlePOST);
