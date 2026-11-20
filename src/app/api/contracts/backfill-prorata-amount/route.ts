import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";

const PRORATA_NOTE = "Pro-rata 租金 (提前入住)";

/** One-time (idempotent) backfill for contracts that got a pro-rata bill before
 * Contract.prorataAmount existed — those only ever left a Payment record behind, with
 * nothing on the contract itself for the tenancy agreement PDF to print. For each contract
 * with pro-rata Payment row(s), sets prorataAmount to their total and adds whatever that
 * total exceeds the contract's current prorataAmount onto totalOutstanding too (so re-running
 * this after new, already-correct pro-rata bills doesn't double-add anything). Does not touch
 * Payment rows — purely backfills the two Contract fields the newer code already keeps in
 * sync going forward. */
export async function POST() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ success: false, message: "只有 Admin 可以执行" }, { status: 403 });
  }

  const prorataPayments = await prisma.payment.findMany({
    where: { notes: PRORATA_NOTE },
    select: { contractId: true, amountDue: true },
  });
  if (prorataPayments.length === 0) {
    return NextResponse.json({ success: true, message: "没有找到任何 Pro-rata 历史账单，不需要修复", updated: 0 });
  }

  const totalByContract = new Map<string, number>();
  for (const p of prorataPayments) {
    totalByContract.set(p.contractId, (totalByContract.get(p.contractId) ?? 0) + Number(p.amountDue));
  }

  const contracts = await prisma.contract.findMany({
    where: { id: { in: [...totalByContract.keys()] } },
    select: { id: true, contractCode: true, prorataAmount: true },
  });

  let updated = 0;
  for (const c of contracts) {
    const total = totalByContract.get(c.id) ?? 0;
    const current = Number(c.prorataAmount);
    if (total <= current) continue; // already up to date (or ahead) — nothing to backfill
    const diff = total - current;
    await prisma.contract.update({
      where: { id: c.id },
      data: {
        prorataAmount: total,
        totalOutstanding: { increment: diff },
      },
    });
    updated++;
  }

  return NextResponse.json({
    success: true,
    message: `✅ 已修复 ${updated} 张合同的 Pro-rata 记录 (共检查 ${contracts.length} 张有 Pro-rata 账单的合同)`,
    updated,
  });
}
