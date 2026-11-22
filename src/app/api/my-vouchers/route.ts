import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { serialize } from "@/lib/serialize";

/** The current user's own vouchers (as a tenant — an Agent who's also a tenant on their own
 * contract sees those too), newest first, for the 我的代金券 card view. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ success: false, message: "请重新登录" }, { status: 401 });

  const vouchers = await prisma.voucher.findMany({
    where: { tenantId: user.sub },
    orderBy: { issuedAt: "desc" },
    include: { contract: { select: { contractCode: true, room: { select: { roomCode: true } } } } },
  });

  return NextResponse.json({
    success: true,
    vouchers: serialize(
      vouchers.map((v) => ({
        id: v.id,
        voucherCode: v.voucherCode,
        contractCode: v.contract.contractCode,
        roomCode: v.contract.room.roomCode,
        amount: v.amount,
        reason: v.reason,
        imageUrl: v.imageUrl,
        template: v.template,
        expiryDate: v.expiryDate,
        status: v.status,
        issuedAt: v.issuedAt,
        redeemedAt: v.redeemedAt,
      }))
    ),
  });
}
