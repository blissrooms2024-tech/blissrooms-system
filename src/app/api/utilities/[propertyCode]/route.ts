import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { myDay } from "@/lib/bills";
import { defaultBillingPeriod, findUnit, getUnitBilling, PERIOD_RE } from "@/lib/utilityBilling";

/** GET /api/utilities/PXC?period=YYYY-MM — meters, last readings, who lived there that month
 * (with exemptions), rates, and the month's bills if already issued. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ propertyCode: string }> }) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "BOSS" && user.role !== "ADMIN")) {
    return NextResponse.json({ success: false, message: "没有权限" }, { status: 403 });
  }
  const { propertyCode } = await params;
  const unit = await findUnit(propertyCode);
  if (!unit) return NextResponse.json({ success: false, message: "找不到这个单位" }, { status: 404 });
  const period = req.nextUrl.searchParams.get("period") || defaultBillingPeriod(myDay());
  if (!PERIOD_RE.test(period)) return NextResponse.json({ success: false, message: "月份不对" }, { status: 400 });
  return NextResponse.json({ success: true, ...(await getUnitBilling(unit, period)) });
}
