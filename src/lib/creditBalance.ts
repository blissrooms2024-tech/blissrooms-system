import { prisma } from "@/lib/prisma";
import { newId } from "@/lib/id";

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
 * any Admin correction) — never just a silent counter decrement.
 *
 * Returns true if the bill was settled this way (caller should skip its usual
 * "bill issued" tenant notification). */
export async function tryApplyCreditToNewBill(
  contractId: string,
  paymentId: string,
  amountDue: number
): Promise<boolean> {
  if (amountDue <= 0) return false;
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    select: { creditBalance: true, tenantId: true, tenantName: true, room: { select: { roomCode: true } } },
  });
  const credit = Number(contract?.creditBalance ?? 0);
  if (!contract || credit < amountDue) return false;

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
  await prisma.contract.update({
    where: { id: contractId },
    data: { creditBalance: { decrement: amountDue } },
  });
  return true;
}
