import { NextRequest, NextResponse } from "next/server";
import { runMonthlyRentJob } from "@/lib/monthlyRentJob";

/** Vercel Cron hits this on the 20th of each month. See runMonthlyRentJob for what it does —
 * this route is just the CRON_SECRET-gated entry point. */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ success: false, message: "unauthorized" }, { status: 401 });
  }

  const result = await runMonthlyRentJob();
  return NextResponse.json({ success: true, ...result });
}
