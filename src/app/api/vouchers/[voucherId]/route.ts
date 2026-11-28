import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { withActivity } from "@/lib/activity";

/** Admin permanently removes a voucher issued by mistake (wrong tenant/room, wrong amount,
 * etc) — a true delete, not a status change, so it leaves no trace in either the admin list
 * or the tenant's own "我的代金券" page. Only allowed before redemption: once redeemed it has
 * already settled a real bill and booked a real Expense, so deleting it would silently undo
 * bookkeeping that actually happened. */
async function handleDELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ voucherId: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ success: false, message: "只有 Admin 可以删除代金券" }, { status: 403 });
  }

  const { voucherId } = await params;
  const voucher = await prisma.voucher.findUnique({ where: { id: voucherId } });
  if (!voucher) return NextResponse.json({ success: false, message: "找不到这张代金券" }, { status: 404 });
  if (voucher.status === "REDEEMED") {
    return NextResponse.json({ success: false, message: "已兑换的代金券不能删除" }, { status: 409 });
  }

  await prisma.voucher.delete({ where: { id: voucherId } });

  return NextResponse.json({ success: true, message: `✅ 代金券 ${voucher.voucherCode} 已删除` });
}

export const DELETE = withActivity(handleDELETE);
