import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { newId } from "@/lib/id";
import { allocateLumpSum, allocationMessage } from "@/lib/allocatePayment";

const schema = z.object({
  amount: z.coerce.number().positive(),
  reason: z.string().trim().min(1, "请填发放原因"),
});

/** Company-issued voucher for a tenant (reward, goodwill, compensation) — spends exactly like
 * cash against whatever this contract currently owes (same priority order and open-bill
 * settlement as "一笔过收款"), with anything left over banked as the contract's own prepaid
 * credit for a future bill. Unlike a real cash payment, no money actually came in to fund this,
 * so it also books the company's own cost of the voucher as an Expense against the room's
 * property — same "every account has to balance" principle as the rest of this system's
 * ledger-style records, just Dr Voucher Expense / Cr Credit (tenant liability) instead of Dr
 * Cash / Cr Credit. The Expense is booked for the FULL voucher amount at issue time, regardless
 * of how much of it gets spent on a bill immediately vs sits as credit — the company's cost is
 * incurred the moment the voucher is handed out, not when the tenant later uses it. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ contractId: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ success: false, message: "只有 Admin 可以发放代金券" }, { status: 403 });
  }
  const { contractId } = await params;
  const c = await prisma.contract.findUnique({
    where: { contractCode: contractId },
    include: { room: { include: { property: true } } },
  });
  if (!c) return NextResponse.json({ success: false, message: "找不到合同" }, { status: 404 });
  if (!c.room.propertyId || !c.room.property) {
    return NextResponse.json({ success: false, message: "这间房没有关联楼盘，没办法登记代金券支出" }, { status: 409 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message ?? "资料不对" }, { status: 400 });
  }
  const { amount, reason } = parsed.data;

  const paidDateValue = new Date();
  const method = `代金券 Voucher (${reason})`;
  const adHocNotes = `代金券抵扣: ${reason}`;

  const result = await allocateLumpSum({
    contract: c,
    amount,
    paidDateValue,
    method,
    receiptUrl: null,
    recordedByName: user.name,
    reviewerName: user.name,
    adHocNotesSingle: adHocNotes,
    adHocNotesMultiple: adHocNotes,
    creditNotes: `预收余额 (代金券: ${reason})`,
  });

  const expenseCode = await newId("EX");
  const now = new Date();
  await prisma.expense.create({
    data: {
      expenseCode,
      propertyId: c.room.propertyId,
      category: "VOUCHER",
      customLabel: reason,
      amount,
      periodMonth: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
      expenseDate: now,
      notes: `代金券发放 (合同 ${c.contractCode}, 租客 ${c.tenantName})`,
      recordedBy: user.name,
    },
  });

  return NextResponse.json({
    success: true,
    message: `✅ 代金券已发放: RM${amount.toFixed(2)} (${reason}) | ${allocationMessage(result)}`,
  });
}
