import { prisma } from "@/lib/prisma";
import { newId } from "@/lib/id";
import { computeBillBreakdown } from "@/lib/billBreakdown";

export interface AllocationResult {
  created: { item: string; amount: number; full: boolean }[];
  remaining: number;
}

interface AllocatableContract {
  id: string;
  tenantId: string | null;
  tenantName: string;
  securityDeposit: unknown;
  utilitiesDeposit: unknown;
  adminFee: unknown;
  accessCardDeposit: unknown;
  carparkRental: unknown;
  roomRental: unknown;
  room: { roomCode: string; isCarpark: boolean };
}

/** Shared by every "hand over one lump sum, settle whatever's owed" flow — cash/bank transfer
 * (collect-lump-sum) and a company voucher (voucher) alike. Settles every open (PENDING/
 * REJECTED) bill of each owing type first (oldest due date first, so a genuine duplicate-bill
 * situation gets fully cleared rather than leaving one dangling), falls back to an ad-hoc
 * record for whatever's left over per item (sized to exactly what's actually collected, never
 * the item's full outstanding — see collect-lump-sum's history for why that distinction
 * matters), and banks any amount beyond what's currently owed as the contract's own CREDIT
 * balance instead of rejecting it. One source of truth for this math so cash and vouchers can
 * never drift apart from each other or from the Payments breakdown they're both measured
 * against. */
export async function allocateLumpSum(opts: {
  contract: AllocatableContract;
  amount: number;
  paidDateValue: Date;
  method: string | null;
  receiptUrl: string | null;
  recordedByName: string;
  reviewerName: string;
  adHocNotesSingle: string | null;
  adHocNotesMultiple: string;
  creditNotes: string;
}): Promise<AllocationResult> {
  const { contract: c, amount, paidDateValue, method, receiptUrl, recordedByName, reviewerName, creditNotes } = opts;

  const allPayments = await prisma.payment.findMany({ where: { contractId: c.id } });
  const { breakdown } = computeBillBreakdown(c, allPayments, c.room.isCarpark);
  const eligible = breakdown.filter((row) => row.outstanding > 0);

  let remaining = amount;
  const created: { item: string; amount: number; full: boolean }[] = [];
  for (const row of eligible) {
    if (remaining <= 0) break;
    const alloc = Math.min(row.outstanding, remaining);
    remaining -= alloc;
    let toAllocate = alloc;

    const openBills = allPayments
      .filter((p) => p.type === row.item && (p.status === "PENDING" || p.status === "REJECTED"))
      .sort((a, b) => (a.dueDate?.getTime() ?? 0) - (b.dueDate?.getTime() ?? 0));

    for (const bill of openBills) {
      if (toAllocate <= 0) break;
      const billRemainder = Math.max(Number(bill.amountDue) - Number(bill.amountPaid), 0);
      // Skip (not break) one this payment can't fully clear — a later, smaller bill in the
      // list might still be affordable with what's left, and should get the same chance.
      if (billRemainder <= 0 || toAllocate < billRemainder) continue;
      await prisma.payment.update({
        where: { id: bill.id },
        data: {
          status: "Paid",
          amountPaid: bill.amountDue,
          paidDate: paidDateValue,
          method: method || bill.method,
          receiptLink: receiptUrl ?? bill.receiptLink,
          reviewedBy: reviewerName,
          reviewedAt: new Date(),
          reviewNote: null,
        },
      });
      toAllocate -= billRemainder;
    }

    if (toAllocate > 0) {
      await prisma.payment.create({
        data: {
          paymentCode: await newId("PY"),
          contractId: c.id,
          roomCode: c.room.roomCode,
          tenantId: c.tenantId,
          tenantName: c.tenantName,
          type: row.item,
          amountDue: toAllocate,
          amountPaid: toAllocate,
          paidDate: paidDateValue,
          method: method || null,
          status: "Paid",
          receiptLink: receiptUrl,
          notes: eligible.length > 1 ? opts.adHocNotesMultiple : opts.adHocNotesSingle,
          recordedBy: recordedByName,
        },
      });
    }
    created.push({ item: row.item, amount: alloc, full: alloc >= row.outstanding });
  }

  // Anything left over after every owing item is fully covered is money paid ahead — banked on
  // the contract as credit instead of being wasted, consumed in full the next time a new bill
  // is opened for an amount the credit can cover.
  if (remaining > 0) {
    await prisma.payment.create({
      data: {
        paymentCode: await newId("PY"),
        contractId: c.id,
        roomCode: c.room.roomCode,
        tenantId: c.tenantId,
        tenantName: c.tenantName,
        type: "CREDIT",
        amountDue: remaining,
        amountPaid: remaining,
        paidDate: paidDateValue,
        method: method || null,
        status: "Paid",
        receiptLink: receiptUrl,
        notes: creditNotes,
        recordedBy: recordedByName,
      },
    });
  }

  return { created, remaining };
}

export function allocationMessage(result: AllocationResult): string {
  const partial = result.created.find((x) => !x.full);
  const creditMsg = result.remaining > 0 ? ` | 多收 RM${result.remaining.toFixed(2)} 已记为预收余额` : "";
  if (result.created.length === 0) return `✅ 已记为预收余额: RM${result.remaining.toFixed(2)}`;
  if (partial) return `✅ 已记 ${result.created.length} 个项目的收款，其中 ${partial.item} 只收了部分${creditMsg}`;
  return `✅ 已记 ${result.created.length} 个项目的收款${creditMsg}`;
}
