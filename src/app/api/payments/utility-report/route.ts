import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import type { PaymentType } from "@/generated/prisma/enums";

const UTILITY_TYPES = ["AC", "DRYER", "ELECTRIC", "OTHER"] as const satisfies readonly PaymentType[];

/** Per-room/tenant detail behind the Revenue Report's company-wide "By Category" totals for
 * AC/Dryer/Electric/Other — Admin wants to see exactly which room/tenant paid what, not just
 * the rolled-up total for the whole company. */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "BOSS" && user.role !== "ADMIN")) {
    return NextResponse.json({ success: false, message: "没有权限" }, { status: 403 });
  }

  const period = req.nextUrl.searchParams.get("period") || "month";
  const typeFilter = req.nextUrl.searchParams.get("type") || "";
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

  const isUtilityType = (v: string): v is (typeof UTILITY_TYPES)[number] =>
    (UTILITY_TYPES as readonly string[]).includes(v);
  const types: PaymentType[] = isUtilityType(typeFilter) ? [typeFilter] : [...UTILITY_TYPES];

  const payments = await prisma.payment.findMany({
    where: {
      status: "Paid",
      type: { in: types },
      ...(rangeStart && rangeEnd ? { paidDate: { gte: rangeStart, lt: rangeEnd } } : {}),
    },
    orderBy: [{ roomCode: "asc" }, { paidDate: "asc" }],
    include: { contract: { select: { contractCode: true } } },
  });

  const totalsByType: Record<string, number> = {};
  const rows = payments.map((p) => {
    const amt = Number(p.amountPaid);
    totalsByType[p.type] = (totalsByType[p.type] || 0) + amt;
    return {
      paymentCode: p.paymentCode,
      contractCode: p.contract.contractCode,
      roomCode: p.roomCode,
      tenantName: p.tenantName,
      type: p.type,
      customLabel: p.customLabel,
      amountPaid: amt,
      paidDate: p.paidDate,
    };
  });

  return NextResponse.json({
    success: true,
    period,
    month,
    year,
    rows,
    totalsByType,
    grandTotal: Object.values(totalsByType).reduce((s, v) => s + v, 0),
  });
}
