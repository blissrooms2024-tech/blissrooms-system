import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";

/** Red-dot counts for the Admin/Boss sidebar — every item here is a one-time action queue
 * (approve, review, activate), not an ongoing report, so a dot here means something new is
 * sitting there unprocessed and would otherwise be easy to miss by only checking 报修/警告信
 * (the only two items that already had their own badge). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "BOSS")) {
    return NextResponse.json({ success: false, message: "没有权限" }, { status: 403 });
  }

  const [pendingApprove, pendingReview, pendingUsers] = await Promise.all([
    prisma.contract.count({ where: { status: "PENDING_APPROVE" } }),
    prisma.payment.count({ where: { status: "PENDING_REVIEW" } }),
    prisma.user.count({ where: { status: "PENDING" } }),
  ]);

  return NextResponse.json({ success: true, pendingApprove, pendingReview, pendingUsers });
}
