import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { RULES } from "@/lib/config";

/** Contracts Admin should be looking at for renewal right now: ACTIVE, with an expiredDate
 * that's already passed or falls inside the notice window — same threshold the "⏰ 快到期"
 * badge on the contracts list and the tenant's own lease-expiry notice use. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ success: false, message: "只有 Admin 可以看" }, { status: 403 });
  }

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const cutoff = new Date(startOfToday);
  cutoff.setMonth(cutoff.getMonth() + RULES.NOTICE_MONTHS);

  const contracts = await prisma.contract.findMany({
    where: { status: "ACTIVE", expiredDate: { lte: cutoff } },
    orderBy: { expiredDate: "asc" },
    include: { room: { select: { roomCode: true } } },
  });

  const list = contracts.map((c) => ({
    contractCode: c.contractCode,
    tenantName: c.tenantName,
    roomCode: c.room.roomCode,
    agentName: c.agentName,
    expiredDate: c.expiredDate,
    daysToExpiry: c.expiredDate
      ? Math.ceil((c.expiredDate.getTime() - startOfToday.getTime()) / (24 * 3600 * 1000))
      : null,
  }));

  return NextResponse.json({ success: true, contracts: list });
}
