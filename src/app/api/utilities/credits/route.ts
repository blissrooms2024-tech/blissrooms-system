import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { withActivity } from "@/lib/activity";
import { creditSchema } from "@/lib/utilitySchemas";
import { KIND_LABELS, round2, type UtilityKind } from "@/lib/utilitySplit";

/** PUT /api/utilities/credits — set a tenancy's prepaid balance for a usage charge (Admin), e.g.
 * correcting what was left on the aircon smart meter. The balance is a ledger, so the change is
 * one more row for the difference, never an edit of history. */
async function handlePUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ success: false, message: "只有 Admin 可以改预付余额" }, { status: 403 });
  const parsed = creditSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, message: "请填正确的金额" }, { status: 400 });
  const d = parsed.data;
  const contract = await prisma.contract.findUnique({ where: { contractCode: d.contractCode }, select: { id: true, tenantName: true } });
  if (!contract) return NextResponse.json({ success: false, message: "找不到合同" }, { status: 404 });

  const agg = await prisma.utilityCredit.aggregate({ where: { contractId: contract.id, kind: d.kind }, _sum: { amount: true } });
  const current = round2(Number(agg._sum.amount ?? 0));
  const diff = round2(d.balance - current);
  const label = KIND_LABELS[d.kind as UtilityKind].zh;
  if (diff === 0) return NextResponse.json({ success: true, message: `${contract.tenantName} 的${label}预付余额没有变化` });
  await prisma.utilityCredit.create({
    data: { contractId: contract.id, kind: d.kind, amount: diff, note: `Admin 调整：RM${current.toFixed(2)} → RM${d.balance.toFixed(2)}`, createdBy: user.name },
  });
  return NextResponse.json({ success: true, message: `已把 ${contract.tenantName} 的${label}预付余额改成 RM${d.balance.toFixed(2)}` });
}

export const PUT = withActivity(handlePUT);
