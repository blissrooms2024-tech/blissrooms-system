import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, type SessionPayload } from "@/lib/auth/session";
import { serialize } from "@/lib/serialize";

function canView(user: SessionPayload, contract: { agentId: string; tenantId: string | null }) {
  if (user.role === "BOSS" || user.role === "ADMIN") return true;
  if (user.role === "AGENT" && contract.agentId === user.sub) return true;
  // Not gated on role === "TENANT": an Agent can also be the tenant on their own contract.
  if (contract.tenantId === user.sub) return true;
  return false;
}

/** Single formal receipt, for the printable /receipt/[paymentCode] page — proof of a payment
 * that's actually been confirmed, not just uploaded/pending review. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ paymentCode: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ success: false, message: "请重新登录" }, { status: 401 });

  const { paymentCode } = await params;
  const payment = await prisma.payment.findUnique({
    where: { paymentCode },
    include: { contract: { include: { room: { select: { roomCode: true } } } } },
  });
  if (!payment) return NextResponse.json({ success: false, message: "找不到这笔账单" }, { status: 404 });
  if (!canView(user, payment.contract)) {
    return NextResponse.json({ success: false, message: "没有权限查看这笔账单" }, { status: 403 });
  }
  if (payment.status !== "Paid") {
    return NextResponse.json({ success: false, message: "这笔账单还没确认收款，还不能开收据" }, { status: 409 });
  }

  return NextResponse.json({
    success: true,
    receipt: serialize({
      paymentCode: payment.paymentCode,
      type: payment.type,
      customLabel: payment.customLabel,
      periodMonth: payment.periodMonth,
      amountPaid: payment.amountPaid,
      method: payment.method,
      paidDate: payment.paidDate,
      recordedBy: payment.recordedBy,
      contractCode: payment.contract.contractCode,
      roomCode: payment.contract.room.roomCode,
      tenantName: payment.contract.tenantName,
      tenantIc: payment.contract.tenantIc,
      propertyAddress: payment.contract.propertyAddress,
    }),
  });
}
