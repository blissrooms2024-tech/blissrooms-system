import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { notifyTenantBillReviewed } from "@/lib/mail";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ success: false, message: "只有 Admin 可以批准" }, { status: 403 });
  }
  const { paymentId } = await params;
  const payment = await prisma.payment.findUnique({ where: { id: paymentId }, include: { contract: true } });
  if (!payment) return NextResponse.json({ success: false, message: "找不到这笔账单" }, { status: 404 });
  if (payment.status !== "PENDING_REVIEW") {
    return NextResponse.json({ success: false, message: "这笔账单不是等审核的状态" }, { status: 409 });
  }

  await prisma.payment.update({
    where: { id: paymentId },
    data: { status: "Paid", reviewedBy: user.name, reviewedAt: new Date(), reviewNote: null },
  });

  if (payment.tenantId) {
    const tenant = await prisma.user.findUnique({ where: { id: payment.tenantId } });
    if (tenant) {
      await notifyTenantBillReviewed(
        tenant,
        {
          paymentCode: payment.paymentCode,
          contractCode: payment.contract.contractCode,
          roomCode: payment.roomCode,
          type: payment.type,
          amountDue: Number(payment.amountDue),
          amountPaid: Number(payment.amountPaid),
        },
        true,
        null,
        user.name
      );
    }
  }

  const label = payment.type === "AC" ? "已充值" : "已批准";
  return NextResponse.json({ success: true, message: `✅ ${payment.paymentCode} ${label}` });
}
