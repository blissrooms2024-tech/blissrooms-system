import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";

const fixDateSchema = z.object({
  action: z.literal("fix-paid-date").optional(),
  paidDate: z.string().trim().min(1, "请填日期"),
  method: z.string().trim().optional(),
});
const editPeriodSchema = z.object({
  action: z.literal("edit-period"),
  periodMonth: z.string().trim().optional(),
  dueDate: z.string().trim().min(1, "请填到期日"),
});
const patchSchema = z.union([editPeriodSchema, fixDateSchema]);

/** Admin-side corrections to a bill after it's been created:
 * - fix-paid-date (default, no `action` needed — the original/only use case before
 *   edit-period existed): corrects a payment's recorded date/method after the fact, mainly
 *   for the placeholder dates the legacy-import/bulk-settle tools stamp on backfilled
 *   "already paid before this system existed" records. Only touches Paid payments.
 * - edit-period: relabels which month a still-open bill (PENDING/PENDING_REVIEW) belongs to
 *   — e.g. the monthly-rent job always opens the NEXT calendar month, so a tenant who was
 *   unverified and missed an earlier month's cron run gets a bill dated for the wrong month
 *   once they're verified; Admin corrects the periodMonth/dueDate here instead of deleting
 *   and losing an already-uploaded slip. */
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
    if (payment.status !== "PENDING" && payment.status !== "PENDING_REVIEW") {
      return NextResponse.json({ success: false, message: "这笔账单的状态不能改月份" }, { status: 400 });
    }
    const dueDate = new Date(parsed.data.dueDate);
    if (isNaN(dueDate.getTime())) {
      return NextResponse.json({ success: false, message: "日期格式不对" }, { status: 400 });
    }
    await prisma.payment.update({
      where: { id: paymentId },
      data: { dueDate, periodMonth: parsed.data.periodMonth || null },
    });
    return NextResponse.json({ success: true, message: "✅ 账单月份已更新" });
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

/** Admin removes a bill that was issued by mistake — a late-fee penalty waived, a wrong-month
 * duplicate, or any bill Admin decides shouldn't exist, including PENDING_REVIEW ones that
 * already have a tenant-uploaded slip (Admin confirmed they want this for cleaning up a messy
 * Outstanding Bills list, understanding it discards that slip and any paid amount — there's no
 * undo). Still refuses an already-Paid/confirmed record; that's the actual settled ledger. */
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
  if (payment.status === "Paid") {
    return NextResponse.json({ success: false, message: "这笔账单已经付款确认, 不能直接删除" }, { status: 409 });
  }

  await prisma.payment.delete({ where: { id: paymentId } });

  return NextResponse.json({
    success: true,
    message: payment.type === "LATE_FEE" ? "✅ 罚款已撤销" : "✅ 账单已删除",
  });
}
