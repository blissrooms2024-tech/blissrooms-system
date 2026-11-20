import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";

const RECURRING_TYPES = new Set(["RENTAL", "CARPARK"]);

/** Finds likely duplicate bills — the root cause of a contract's "应收" (cumulative billed)
 * looking inflated: the breakdown sums every bill's amountDue for a type, so two bills that
 * both represent the same real charge (e.g. the same month's rent entered twice, or a one-time
 * item like Deposit/Admin Fee billed more than once) double-count. Grouping key:
 *  - RENTAL/CARPARK with a periodMonth: (contract, type, periodMonth) — one bill per month.
 *  - Everything else (DEPOSIT/UTILITIES/ADMIN_FEE/ACCESS_CARD, and a RENTAL/CARPARK row with no
 *    periodMonth — a pro-rata or legacy row): (contract, type) — normally a one-time charge.
 * Any group with more than one row is flagged for Admin to review and delete the wrong one
 * with the Payment History delete button. Read-only — never changes anything itself. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ success: false, message: "只有 Admin 可以看" }, { status: 403 });
  }

  const payments = await prisma.payment.findMany({
    where: { type: { in: ["DEPOSIT", "UTILITIES", "ADMIN_FEE", "ACCESS_CARD", "RENTAL", "CARPARK"] } },
    include: { contract: { select: { contractCode: true, tenantName: true } } },
    orderBy: { id: "asc" },
  });

  const groups = new Map<
    string,
    { contractCode: string; tenantName: string; type: string; periodMonth: string | null; rows: typeof payments }
  >();

  for (const p of payments) {
    const key =
      RECURRING_TYPES.has(p.type) && p.periodMonth
        ? `${p.contractId}|${p.type}|${p.periodMonth}`
        : `${p.contractId}|${p.type}|onetime`;
    const existing = groups.get(key);
    if (existing) {
      existing.rows.push(p);
    } else {
      groups.set(key, {
        contractCode: p.contract.contractCode,
        tenantName: p.contract.tenantName,
        type: p.type,
        periodMonth: RECURRING_TYPES.has(p.type) ? p.periodMonth : null,
        rows: [p],
      });
    }
  }

  const duplicates = Array.from(groups.values())
    .filter((g) => g.rows.length > 1)
    .map((g) => ({
      contractCode: g.contractCode,
      tenantName: g.tenantName,
      type: g.type,
      periodMonth: g.periodMonth,
      totalAmountDue: g.rows.reduce((s, p) => s + Number(p.amountDue), 0),
      rows: g.rows.map((p) => ({
        paymentCode: p.paymentCode,
        amountDue: Number(p.amountDue),
        amountPaid: Number(p.amountPaid),
        status: p.status,
        dueDate: p.dueDate,
        paidDate: p.paidDate,
        notes: p.notes,
      })),
    }))
    .sort((a, b) => a.contractCode.localeCompare(b.contractCode));

  return NextResponse.json({ success: true, duplicates });
}
