import { NextRequest, NextResponse } from "next/server";
import { runDeactivateExpiredTenants } from "@/lib/deactivateExpiredTenants";

/** Vercel Cron hits this daily. See runDeactivateExpiredTenants for the actual logic — shared
 * with the Admin-triggered manual run at POST /api/users/deactivate-expired. */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ success: false, message: "unauthorized" }, { status: 401 });
  }

  const result = await runDeactivateExpiredTenants();
  return NextResponse.json({ success: true, ...result });
}
