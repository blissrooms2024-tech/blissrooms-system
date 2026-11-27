import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { myDay } from "@/lib/bills";
import { billingOverview, defaultBillingPeriod, getRates, PERIOD_RE } from "@/lib/utilityBilling";

/** GET /api/utilities?period=YYYY-MM — every unit with meters and whether that month is billed. */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "BOSS" && user.role !== "ADMIN")) {
    return NextResponse.json({ success: false, message: "没有权限" }, { status: 403 });
  }
  const period = req.nextUrl.searchParams.get("period") || defaultBillingPeriod(myDay());
  if (!PERIOD_RE.test(period)) return NextResponse.json({ success: false, message: "月份不对" }, { status: 400 });

  const [units, rates, others] = await Promise.all([
    billingOverview(period),
    getRates(),
    prisma.property.findMany({
      where: { utilityMeters: { none: { active: true } }, OR: [{ status: null }, { status: { not: "Inactive" } }] },
      select: { propertyCode: true, name: true },
      orderBy: { propertyCode: "asc" },
    }),
  ]);
  return NextResponse.json({ success: true, period, defaultPeriod: defaultBillingPeriod(myDay()), units, rates, unitsWithoutMeters: others });
}
