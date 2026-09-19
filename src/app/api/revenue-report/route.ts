import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";

/** Company-wide revenue report behind the dashboard's 营业额 boxes — same idea as the
 * per-property monthly report, just rolled up across every property. */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "BOSS" && user.role !== "ADMIN")) {
    return NextResponse.json({ success: false, message: "没有权限" }, { status: 403 });
  }

  const period = req.nextUrl.searchParams.get("period") || "month";
  const now = new Date();

  let rangeStart: Date | null = null;
  let rangeEnd: Date | null = null;
  let month = "";
  let year = now.getFullYear();

  if (period === "month") {
    month = req.nextUrl.searchParams.get("month") || now.toISOString().slice(0, 7);
    const m = /^(\d{4})-(\d{2})$/.exec(month);
    if (!m) return NextResponse.json({ success: false, message: "月份格式不对, 要 YYYY-MM" }, { status: 400 });
    rangeStart = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1));
    rangeEnd = new Date(Date.UTC(Number(m[1]), Number(m[2]), 1));
  } else if (period === "year") {
    year = Number(req.nextUrl.searchParams.get("year")) || now.getFullYear();
    rangeStart = new Date(Date.UTC(year, 0, 1));
    rangeEnd = new Date(Date.UTC(year + 1, 0, 1));
  } else if (period !== "all") {
    return NextResponse.json({ success: false, message: "period 要是 month / year / all" }, { status: 400 });
  }

  const payments = await prisma.payment.findMany({
    where: {
      status: "Paid",
      ...(rangeStart && rangeEnd ? { paidDate: { gte: rangeStart, lt: rangeEnd } } : {}),
    },
    select: { roomCode: true, type: true, amountPaid: true },
  });

  const roomCodes = [...new Set(payments.map((p) => p.roomCode))];
  const rooms = roomCodes.length
    ? await prisma.room.findMany({ where: { roomCode: { in: roomCodes } }, select: { roomCode: true, propertyName: true } })
    : [];
  const propertyByRoom = new Map(rooms.map((r) => [r.roomCode, r.propertyName]));

  const byType: Record<string, number> = {};
  const byPropertyMap = new Map<string, number>();
  let total = 0;

  for (const p of payments) {
    const amt = Number(p.amountPaid);
    total += amt;
    byType[p.type] = (byType[p.type] || 0) + amt;
    const propertyName = propertyByRoom.get(p.roomCode) ?? "其他";
    byPropertyMap.set(propertyName, (byPropertyMap.get(propertyName) ?? 0) + amt);
  }

  const byProperty = Array.from(byPropertyMap.entries())
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount);

  return NextResponse.json({
    success: true,
    period,
    month,
    year,
    total,
    byType,
    byProperty,
    transactionCount: payments.length,
  });
}
