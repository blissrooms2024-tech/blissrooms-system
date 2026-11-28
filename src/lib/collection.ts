import { prisma } from "@/lib/prisma";
import { addMonths, myDay } from "@/lib/bills";

/**
 * 收款 for one month: of the tenant bills that belong to that month, how much is already
 * collected, how much is waiting for a slip review, and how much is still unpaid.
 *
 * A bill belongs to its billing month (periodMonth) when it has one — monthly rent, carpark,
 * utilities. One-off bills without a billing month (deposits, admin fee, ad-hoc charges) count
 * in the month they're due, and a payment recorded with neither (cash taken on the spot, or the
 * leftover part of a lump sum) in the month it was paid. CREDIT rows are a prepaid-balance
 * ledger, not a bill, so they're left out — the bill a credit settles is counted instead.
 */

export type Bucket = { amount: number; count: number };
export type CollectionData = {
  month: string;
  collected: Bucket;
  reviewing: Bucket;
  unpaid: Bucket;
  /** Part of `unpaid` whose due date has passed. */
  overdue: Bucket;
  billed: number;
  /** collected ÷ billed, 0 when nothing was billed. */
  rate: number;
};

export const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function getCollection(month: string): Promise<CollectionData> {
  const start = new Date(`${month}-01T00:00:00.000Z`);
  const end = new Date(`${addMonths(month, 1)}-01T00:00:00.000Z`);
  const today = myDay();

  const rows = await prisma.payment.findMany({
    where: {
      type: { not: "CREDIT" },
      OR: [
        { periodMonth: month },
        { periodMonth: null, dueDate: { gte: start, lt: end } },
        { periodMonth: null, dueDate: null, paidDate: { gte: start, lt: end } },
      ],
    },
    select: { status: true, amountDue: true, amountPaid: true, dueDate: true },
  });

  const b = () => ({ amount: 0, count: 0 });
  const collected = b();
  const reviewing = b();
  const unpaid = b();
  const overdue = b();
  for (const r of rows) {
    if (r.status === "Paid") {
      collected.amount += Number(r.amountPaid);
      collected.count++;
    } else if (r.status === "PENDING_REVIEW") {
      reviewing.amount += Number(r.amountDue);
      reviewing.count++;
    } else if (r.status === "PENDING" || r.status === "REJECTED") {
      const owed = Math.max(Number(r.amountDue) - Number(r.amountPaid), 0);
      unpaid.amount += owed;
      unpaid.count++;
      if (r.dueDate && r.dueDate < today) {
        overdue.amount += owed;
        overdue.count++;
      }
    }
  }
  for (const x of [collected, reviewing, unpaid, overdue]) x.amount = round2(x.amount);
  const billed = round2(collected.amount + reviewing.amount + unpaid.amount);
  return { month, collected, reviewing, unpaid, overdue, billed, rate: billed > 0 ? collected.amount / billed : 0 };
}
