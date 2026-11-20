import { prisma } from "@/lib/prisma";
import { newId } from "@/lib/id";

/** The contract's prepaid credit balance isn't a separately stored field — it's always just the
 * live sum of this contract's CREDIT-type Payment rows (positive deposits, negative draw-downs,
 * either sign for an Admin correction). Computing it fresh every time, instead of caching it on
 * Contract and trying to keep that cache in lockstep with the ledger, is what guarantees it can
 * never drift out of sync with its own history — including when Admin corrects one of these
 * rows directly via the ordinary "改金额" button every other Payment type already has. */
export async function computeCreditBalance(contractId: string): Promise<number> {
  const agg = await prisma.payment.aggregate({
    where: { contractId, type: "CREDIT", status: "Paid" },
    _sum: { amountPaid: true },
  });
  return Number(agg._sum.amountPaid ?? 0);
}

/** When a newly-opened bill can be fully covered by a contract's existing prepaid credit
 * (money collected via lump-sum that exceeded what was actually owed at the time), settle it
 * immediately instead of leaving it PENDING for the tenant to pay again.
 *
 * Only ever applies the credit in FULL against the WHOLE bill, never partially — a bill that
 * took a partial credit and stayed PENDING would leave that amount invisible everywhere else
 * in the system (every other screen only counts amountPaid on an already-Paid row). A credit
 * too small to fully cover this bill is simply left untouched for the next opportunity.
 *
 * Also records a negative CREDIT-type Payment row for the draw-down, so the balance change has
 * the same paper trail as every other movement of this money (the deposit that created it, and
 * any Admin correction).
 *
 * Returns true if the bill was settled this way (caller should skip its usual
 * "bill issued" tenant notification). */
export async function tryApplyCreditToNewBill(
  contractId: string,
  paymentId: string,
  amountDue: number
): Promise<boolean> {
  if (amountDue <= 0) return false;
  const credit = await computeCreditBalance(contractId);
  if (credit < amountDue) return false;

  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    select: { tenantId: true, tenantName: true, room: { select: { roomCode: true } } },
  });
  if (!contract) return false;

  const payment = await prisma.payment.update({
    where: { id: paymentId },
    data: {
      status: "Paid",
      amountPaid: amountDue,
      paidDate: new Date(),
      method: "预收余额抵扣 (Credit Balance)",
    },
  });
  await prisma.payment.create({
    data: {
      paymentCode: await newId("PY"),
      contractId,
      roomCode: contract.room.roomCode,
      tenantId: contract.tenantId,
      tenantName: contract.tenantName,
      type: "CREDIT",
      amountDue: -amountDue,
      amountPaid: -amountDue,
      paidDate: new Date(),
      status: "Paid",
      notes: `抵扣账单 ${payment.paymentCode} (预收余额已用)`,
      recordedBy: "System",
    },
  });
  return true;
}
