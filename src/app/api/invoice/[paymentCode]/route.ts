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

/** Single formal invoice, for the printable /invoice/[paymentCode] page — a bill still owed
 * (or awaiting review), presented as a proper document instead of just a table row. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ paymentCode: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ success: false, message: "请重新登录" }, { status: 401 });

  const { paymentCode } = await params;
  const payment = await prisma.payment.findUnique({
    where: { paymentCode },
    include: {
      contract: {
        include: {
          room: { select: { roomCode: true, isCarpark: true, carparkLotNumber: true } },
          carparkRoom: { select: { roomCode: true, carparkLotNumber: true } },
        },
      },
    },
  });
  if (!payment) return NextResponse.json({ success: false, message: "找不到这笔账单" }, { status: 404 });
  if (!canView(user, payment.contract)) {
    return NextResponse.json({ success: false, message: "没有权限查看这笔账单" }, { status: 403 });
  }

  const { room, carparkRoom } = payment.contract;
  // Either the main room itself IS the carpark, or there's a separate linked carpark add-on.
  const carparkLotNumber = room.isCarpark ? room.carparkLotNumber : (carparkRoom?.carparkLotNumber ?? null);

  return NextResponse.json({
    success: true,
    invoice: serialize({
      paymentCode: payment.paymentCode,
      type: payment.type,
      customLabel: payment.customLabel,
      periodMonth: payment.periodMonth,
      amountDue: payment.amountDue,
      amountPaid: payment.amountPaid,
      status: payment.status,
      dueDate: payment.dueDate,
      contractCode: payment.contract.contractCode,
      roomCode: room.roomCode,
      carparkLotNumber,
      tenantName: payment.contract.tenantName,
      tenantIc: payment.contract.tenantIc,
      propertyAddress: payment.contract.propertyAddress,
    }),
  });
}
