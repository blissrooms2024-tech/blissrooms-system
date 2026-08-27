import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";

/** Admin waives a late-fee penalty before it's paid — e.g. the tenant had a legitimate
 * reason, or the charge was raised in error. Deliberately scoped to LATE_FEE only, and only
 * while it's still unpaid (PENDING/REJECTED) — once a real payment is involved (PENDING_REVIEW
 * with a slip, or already Paid) this isn't a simple delete anymore. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ success: false, message: "只有 Admin 可以撤销罚款" }, { status: 403 });
  }
  const { paymentId } = await params;
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) return NextResponse.json({ success: false, message: "找不到这笔账单" }, { status: 404 });
  if (payment.type !== "LATE_FEE") {
    return NextResponse.json({ success: false, message: "只能撤销迟交罚款" }, { status: 400 });
  }
  if (payment.status !== "PENDING" && payment.status !== "REJECTED") {
    return NextResponse.json({ success: false, message: "这笔罚款已经在处理/已付款, 不能直接撤销" }, { status: 409 });
  }

  await prisma.payment.delete({ where: { id: paymentId } });

  return NextResponse.json({ success: true, message: "✅ 罚款已撤销" });
}
