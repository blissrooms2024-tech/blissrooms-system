import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { withActivity } from "@/lib/activity";
import { fmtDate } from "@/lib/format";
import { exemptionPatchSchema } from "@/lib/utilitySchemas";
import { KIND_LABELS, type UtilityKind } from "@/lib/utilitySplit";

type Ctx = { params: Promise<{ exemptionId: string }> };

const load = (id: string) =>
  prisma.utilityExemption.findUnique({ where: { id }, include: { contract: { select: { contractCode: true, tenantName: true } } } });

/** PATCH — change when an exemption ends, or its reason (Admin). */
async function handlePATCH(req: NextRequest, { params }: Ctx) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ success: false, message: "只有 Admin 可以改豁免" }, { status: 403 });
  const { exemptionId } = await params;
  const ex = await load(exemptionId);
  if (!ex) return NextResponse.json({ success: false, message: "找不到这个豁免" }, { status: 404 });
  const parsed = exemptionPatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, message: "请写豁免的原因" }, { status: 400 });
  const end = parsed.data.endDate ? new Date(`${parsed.data.endDate}T00:00:00.000Z`) : null;
  if (end && end < ex.startDate) return NextResponse.json({ success: false, message: "结束日期不能早过开始日期" }, { status: 400 });
  await prisma.utilityExemption.update({ where: { id: exemptionId }, data: { endDate: end, reason: parsed.data.reason } });
  const label = KIND_LABELS[ex.kind as UtilityKind]?.zh ?? ex.kind;
  return NextResponse.json({
    success: true,
    message: `${ex.contract.contractCode} ${ex.contract.tenantName} 的${label}豁免改为${parsed.data.endDate ? `到 ${fmtDate(parsed.data.endDate)}` : "到合约结束"}`,
  });
}

/** DELETE — cancel an exemption; from the next bill the tenant pays their share again. */
async function handleDELETE(_req: NextRequest, { params }: Ctx) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ success: false, message: "只有 Admin 可以取消豁免" }, { status: 403 });
  const { exemptionId } = await params;
  const ex = await load(exemptionId);
  if (!ex) return NextResponse.json({ success: false, message: "找不到这个豁免" }, { status: 404 });
  await prisma.utilityExemption.delete({ where: { id: exemptionId } });
  const label = KIND_LABELS[ex.kind as UtilityKind]?.zh ?? ex.kind;
  return NextResponse.json({ success: true, message: `已取消 ${ex.contract.contractCode} ${ex.contract.tenantName} 的${label}豁免` });
}

export const PATCH = withActivity(handlePATCH);
export const DELETE = withActivity(handleDELETE);
