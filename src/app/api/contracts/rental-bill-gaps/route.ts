import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";

/** Admin's "which rooms still need this cycle's rental/carpark bill" check — mirrors the same
 * periodMonth and RENTAL+CARPARK logic the monthly cron (runMonthlyRentJob) uses, so it flags
 * exactly the bills the automatic run would have created, but didn't (most often: a tenant who
 * was unverified when the cron last fired). Only looks at contracts that are ACTIVE and not
 * already past their expiry date — an expired tenant shouldn't get a fresh bill (and a fresh
 * notification email) just because nobody's formally terminated/moved them out yet. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ success: false, message: "没有权限" }, { status: 403 });
  }

  const now = new Date();
  const nextMonthYear = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();
  const nextMonthIndex = (now.getMonth() + 1) % 12;
  const targetMonth = `${nextMonthYear}-${String(nextMonthIndex + 1).padStart(2, "0")}`;

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const contracts = await prisma.contract.findMany({
    where: {
      status: "ACTIVE",
      OR: [{ expiredDate: null }, { expiredDate: { gte: startOfToday } }],
    },
    include: { room: { select: { roomCode: true } } },
  });

  const billed = await prisma.payment.findMany({
    where: { type: { in: ["RENTAL", "CARPARK"] }, periodMonth: targetMonth, contractId: { in: contracts.map((c) => c.id) } },
    select: { contractId: true, type: true },
  });
  const billedRentalSet = new Set(billed.filter((b) => b.type === "RENTAL").map((b) => b.contractId));
  const billedCarparkSet = new Set(billed.filter((b) => b.type === "CARPARK").map((b) => b.contractId));

  const rentalGaps = contracts
    .filter((c) => !billedRentalSet.has(c.id))
    .map((c) => ({
      contractCode: c.contractCode,
      roomCode: c.room.roomCode,
      tenantName: c.tenantName,
      billType: "RENTAL" as const,
      amount: Number(c.roomRental),
    }));
  const carparkGaps = contracts
    .filter((c) => Number(c.carparkRental) > 0 && !billedCarparkSet.has(c.id))
    .map((c) => ({
      contractCode: c.contractCode,
      roomCode: c.room.roomCode,
      tenantName: c.tenantName,
      billType: "CARPARK" as const,
      amount: Number(c.carparkRental),
    }));

  const gaps = [...rentalGaps, ...carparkGaps].sort((a, b) => a.roomCode.localeCompare(b.roomCode));

  return NextResponse.json({ success: true, targetMonth, gaps });
}
