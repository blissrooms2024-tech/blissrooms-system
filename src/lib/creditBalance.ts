import { prisma } from "@/lib/prisma";

/** When a newly-opened bill can be fully covered by a contract's existing prepaid credit
 * (money collected via lump-sum that exceeded what was actually owed at the time), settle it
 * immediately instead of leaving it PENDING for the tenant to pay again.
 *
 * Only ever applies the credit in FULL against the WHOLE bill, never partially — a bill that
 * took a partial credit and stayed PENDING would leave that amount invisible everywhere else
 * in the system (every other screen only counts amountPaid on an already-Paid row). A credit
 * too small to fully cover this bill is simply left untouched for the next opportunity.
 *
 * Returns true if the bill was settled this way (caller should skip its usual
 * "bill issued" tenant notification). */
export async function tryApplyCreditToNewBill(
  contractId: string,
  paymentId: string,
  amountDue: number
): Promise<boolean> {
  if (amountDue <= 0) return false;
  const contract = await prisma.contract.findUnique({ where: { id: contractId }, select: { creditBalance: true } });
  const credit = Number(contract?.creditBalance ?? 0);
  if (credit < amountDue) return false;

  await prisma.payment.update({
    where: { id: paymentId },
    data: {
      status: "Paid",
      amountPaid: amountDue,
      paidDate: new Date(),
      method: "预收余额抵扣 (Credit Balance)",
    },
  });
  await prisma.contract.update({
    where: { id: contractId },
    data: { creditBalance: { decrement: amountDue } },
  });
  return true;
}
