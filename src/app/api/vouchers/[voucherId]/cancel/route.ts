import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";

/** Admin voids a voucher issued by mistake. Only works before it's been redeemed — nothing
 * financial has happened yet at that point, so there's nothing to unwind. */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ voucherId: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ success: false, message: "只有 Admin 可以取消代金券" }, { status: 403 });
  }

  const { voucherId } = await params;
  const voucher = await prisma.voucher.findUnique({ where: { id: voucherId } });
  if (!voucher) return NextResponse.json({ success: false, message: "找不到这张代金券" }, { status: 404 });
  if (voucher.status !== "ISSUED") {
    return NextResponse.json({ success: false, message: "只能取消还没兑换的代金券" }, { status: 409 });
  }

  await prisma.voucher.update({ where: { id: voucherId }, data: { status: "CANCELLED" } });

  return NextResponse.json({ success: true, message: `✅ 代金券 ${voucher.voucherCode} 已取消` });
}
