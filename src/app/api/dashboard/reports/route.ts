import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { currentPeriod, getReports } from "@/lib/reports";

/** GET /api/dashboard/reports?month=YYYY-MM&year=YYYY — Boss/Admin home-page reports. */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "BOSS" && user.role !== "ADMIN")) {
    return NextResponse.json({ success: false, message: "没有权限" }, { status: 403 });
  }
  const cur = currentPeriod();
  const month = req.nextUrl.searchParams.get("month") || cur;
  const year = Number(req.nextUrl.searchParams.get("year") || cur.slice(0, 4));
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || month > cur) {
    return NextResponse.json({ success: false, message: "月份不对（不能选未来的月份）" }, { status: 400 });
  }
  if (!Number.isInteger(year) || year < 2000 || year > Number(cur.slice(0, 4))) {
    return NextResponse.json({ success: false, message: "年份不对" }, { status: 400 });
  }
  return NextResponse.json({ success: true, ...(await getReports(month, year)) });
}
