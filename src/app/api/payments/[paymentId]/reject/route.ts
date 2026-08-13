import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { notifyTenantBillReviewed } from "@/lib/mail";

const schema = z.object({ reason: z.string().trim().min(1) });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ success: false, message: "只有 Admin 可以拒绝" }, { status: 403 });
  }
  const { paymentId } = await params;
  const payment = await prisma.payment.findUnique({ where: { id: paymentId }, include: { contract: true } });
  if (!payment) return NextResponse.json({ success: false, message: "找不到这笔账单" }, { status: 404 });
  if (payment.status !== "PENDING_REVIEW") {
    return NextResponse.json({ success: false, message: "这笔账单不是等审核的状态" }, { status: 409 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "请填拒绝原因" }, { status: 400 });
  }

  await prisma.payment.update({
    where: { id: paymentId },
    data: {
      status: "REJECTED",
      amountPaid: 0,
      reviewedBy: user.name,
      reviewedAt: new Date(),
      reviewNote: parsed.data.reason,
    },
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
          amountPaid: Number(payment.amountDue),
        },
        false,
        parsed.data.reason,
        user.name
      );
    }
  }

  return NextResponse.json({ success: true, message: `已拒绝 ${payment.paymentCode}，租客需要重新上传` });
}
