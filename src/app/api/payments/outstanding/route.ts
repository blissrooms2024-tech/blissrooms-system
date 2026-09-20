import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { serialize } from "@/lib/serialize";

/** Every bill Admin has issued that isn't Paid yet — PENDING (tenant hasn't uploaded a slip),
 * PENDING_REVIEW (slip uploaded, awaiting approval — also in /payments/review), and REJECTED
 * (tenant needs to re-upload). Without this, a bill like a DRYER charge sits invisible until
 * someone opens that one tenant's contract — Admin can't spot it to follow up otherwise. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !["ADMIN", "BOSS"].includes(user.role)) {
    return NextResponse.json({ success: false, message: "没有权限" }, { status: 403 });
  }

  const payments = await prisma.payment.findMany({
    where: { status: { in: ["PENDING", "PENDING_REVIEW", "REJECTED"] } },
    orderBy: [{ dueDate: "asc" }],
    include: { contract: { select: { contractCode: true, agentName: true } } },
  });

  return NextResponse.json({
    success: true,
    payments: serialize(
      payments.map((p) => ({
        id: p.id,
        paymentCode: p.paymentCode,
        contractCode: p.contract.contractCode,
        agentName: p.contract.agentName,
        roomCode: p.roomCode,
        tenantName: p.tenantName,
        type: p.type,
        status: p.status,
        amountDue: p.amountDue,
        amountPaid: p.amountPaid,
        periodMonth: p.periodMonth,
        dueDate: p.dueDate,
        reviewNote: p.reviewNote,
        customLabel: p.customLabel,
      }))
    ),
  });
}
