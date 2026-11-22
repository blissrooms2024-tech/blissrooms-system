import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { notifyTenantBillReviewed } from "@/lib/mail";

const fixDateSchema = z.object({
  action: z.literal("fix-paid-date").optional(),
  paidDate: z.string().trim().min(1, "请填日期"),
  method: z.string().trim().optional(),
});
const editPeriodSchema = z.object({
  action: z.literal("edit-period"),
  periodMonth: z.string().trim().optional(),
  dueDate: z.string().trim().optional(),
});
const markPaidSchema = z.object({
  action: z.literal("mark-paid"),
  paidDate: z.string().trim().optional(),
  method: z.string().trim().optional(),
});
const editAmountSchema = z.object({
  action: z.literal("edit-amount"),
  amountDue: z.coerce.number().min(0, "请填金额"),
});
const patchSchema = z.union([editPeriodSchema, markPaidSchema, editAmountSchema, fixDateSchema]);

/** Admin-side corrections to a bill after it's been created:
 * - fix-paid-date (default, no `action` needed — the original/only use case before
 *   edit-period existed): corrects a payment's recorded date/method after the fact, mainly
 *   for the placeholder dates the legacy-import/bulk-settle tools stamp on backfilled
 *   "already paid before this system existed" records. Only touches Paid payments.
 * - edit-period: relabels which month a bill belongs to — e.g. the monthly-rent job always
 *   opens the NEXT calendar month, so a tenant who was unverified and missed an earlier
 *   month's cron run gets a bill dated for the wrong month once they're verified; Admin
 *   corrects the periodMonth/dueDate here instead of deleting and losing an already-uploaded
 *   slip. Works on any status, including already-Paid rows in Payment History — those often
 *   have no periodMonth at all (a lump-sum collection or legacy import never asked for one),
 *   which makes several months of the same recurring charge indistinguishable from each other
 *   in that list; dueDate is left untouched when not given, since it stops mattering once a
 *   bill is settled.
 * - mark-paid: Admin confirms a bill as paid directly (e.g. tenant paid cash/offline), with
 *   a chosen paid date/method, skipping the usual tenant-uploads-slip-then-Admin-approves
 *   flow entirely. Works on any not-yet-Paid bill (PENDING/PENDING_REVIEW/REJECTED).
 * - edit-amount: corrects a mis-entered amount directly on the bill/record itself. Needed
 *   because every "应收" total is `max(contract's own reference field, sum of this type's
 *   billed amountDue)` — once a wrong amount has actually been billed, raising/lowering the
 *   contract-level field alone can't bring the total back down, since the old Payment row's
 *   amountDue still counts. Works on any status; a Paid record's amountPaid is kept in sync
 *   with the corrected amountDue (a Paid row always represents a fully-settled amount, not a
 *   partial one). */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ success: false, message: "只有 Admin 可以修改账单" }, { status: 403 });
  }
  const { paymentId } = await params;
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) return NextResponse.json({ success: false, message: "找不到这笔记录" }, { status: 404 });

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message ?? "资料不对" }, { status: 400 });
  }

  if (parsed.data.action === "edit-period") {
    let dueDate: Date | undefined;
    if (parsed.data.dueDate) {
      dueDate = new Date(parsed.data.dueDate);
      if (isNaN(dueDate.getTime())) {
        return NextResponse.json({ success: false, message: "日期格式不对" }, { status: 400 });
      }
    }
    await prisma.payment.update({
      where: { id: paymentId },
      data: { periodMonth: parsed.data.periodMonth || null, ...(dueDate ? { dueDate } : {}) },
    });
    return NextResponse.json({ success: true, message: "✅ 月份已更新" });
  }

  if (parsed.data.action === "mark-paid") {
    if (payment.status === "Paid") {
      return NextResponse.json({ success: false, message: "这笔账单已经是已付状态" }, { status: 400 });
    }
    const paidDate = parsed.data.paidDate ? new Date(parsed.data.paidDate) : new Date();
    if (isNaN(paidDate.getTime())) {
      return NextResponse.json({ success: false, message: "日期格式不对" }, { status: 400 });
    }
    const contract = await prisma.contract.findUnique({ where: { id: payment.contractId } });
    await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: "Paid",
        amountPaid: payment.amountDue,
        paidDate,
        method: parsed.data.method || payment.method,
        reviewedBy: user.name,
        reviewedAt: new Date(),
        reviewNote: null,
      },
    });

    if (payment.tenantId && contract) {
      const tenant = await prisma.user.findUnique({ where: { id: payment.tenantId } });
      if (tenant) {
        await notifyTenantBillReviewed(
          tenant,
          {
            paymentCode: payment.paymentCode,
            contractCode: contract.contractCode,
            roomCode: payment.roomCode,
            type: payment.type,
            amountDue: Number(payment.amountDue),
            amountPaid: Number(payment.amountDue),
          },
          true,
          null,
          user.name
        );
      }
    }

    return NextResponse.json({ success: true, message: `✅ ${payment.paymentCode} 已标记为已付` });
  }

  if (parsed.data.action === "edit-amount") {
    await prisma.payment.update({
      where: { id: paymentId },
      data: {
        amountDue: parsed.data.amountDue,
        ...(payment.status === "Paid" ? { amountPaid: parsed.data.amountDue } : {}),
      },
    });
    return NextResponse.json({ success: true, message: "✅ 金额已更新" });
  }

  if (payment.status !== "Paid") {
    return NextResponse.json({ success: false, message: "只能改已付款的记录" }, { status: 400 });
  }
  const paidDate = new Date(parsed.data.paidDate);
  if (isNaN(paidDate.getTime())) {
    return NextResponse.json({ success: false, message: "日期格式不对" }, { status: 400 });
  }

  await prisma.payment.update({
    where: { id: paymentId },
    data: { paidDate, method: parsed.data.method || payment.method },
  });

  return NextResponse.json({ success: true, message: "✅ 已更新收款日期" });
}

/** Admin removes a payment record by mistake — a late-fee penalty waived, a wrong-month
 * duplicate, a mis-entered amount in the Payment History, or any bill/record Admin decides
 * shouldn't exist, including PENDING_REVIEW ones that already have a tenant-uploaded slip, and
 * already-Paid records in the Payment History (deleting one reduces "已收" and correspondingly
 * increases "还欠" for that contract). Admin confirmed they want this for cleaning up mistakes —
 * there's no undo either way. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ success: false, message: "只有 Admin 可以删除账单" }, { status: 403 });
  }
  const { paymentId } = await params;
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) return NextResponse.json({ success: false, message: "找不到这笔账单" }, { status: 404 });

  await prisma.payment.delete({ where: { id: paymentId } });

  return NextResponse.json({
    success: true,
    message:
      payment.type === "LATE_FEE"
        ? "✅ 罚款已撤销"
        : payment.status === "Paid"
          ? "✅ 收款记录已删除"
          : "✅ 账单已删除",
  });
}
