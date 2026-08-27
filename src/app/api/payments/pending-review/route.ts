import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { serialize } from "@/lib/serialize";

/** Admin's queue of tenant-uploaded slips awaiting approval/rejection. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !["ADMIN", "BOSS"].includes(user.role)) {
    return NextResponse.json({ success: false, message: "没有权限" }, { status: 403 });
  }

  const payments = await prisma.payment.findMany({
    where: { status: "PENDING_REVIEW" },
    orderBy: { paidDate: "asc" },
    include: { contract: { select: { contractCode: true } } },
  });

  return NextResponse.json({
    success: true,
    payments: serialize(
      payments.map((p) => ({
        id: p.id,
        paymentCode: p.paymentCode,
        contractCode: p.contract.contractCode,
        roomCode: p.roomCode,
        tenantName: p.tenantName,
        type: p.type,
        amountDue: p.amountDue,
        amountPaid: p.amountPaid,
        periodMonth: p.periodMonth,
        dueDate: p.dueDate,
        paidDate: p.paidDate,
        receiptLink: p.receiptLink,
        notes: p.notes,
        customLabel: p.customLabel,
      }))
    ),
  });
}
