import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { addMonths } from "@/lib/bills";
import { getCollection, MONTH_RE } from "@/lib/collection";
import { currentPeriod } from "@/lib/reports";

/** GET /api/dashboard/collection?month=YYYY-MM — the home page's 收款 card for one month. */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "BOSS" && user.role !== "ADMIN")) {
    return NextResponse.json({ success: false, message: "没有权限" }, { status: 403 });
  }
  const month = req.nextUrl.searchParams.get("month") || currentPeriod();
  // Next month is allowed: its rent bills are often issued before the month starts.
  if (!MONTH_RE.test(month) || month > addMonths(currentPeriod(), 1)) {
    return NextResponse.json({ success: false, message: "月份不对" }, { status: 400 });
  }
  return NextResponse.json({ success: true, ...(await getCollection(month)) });
}
