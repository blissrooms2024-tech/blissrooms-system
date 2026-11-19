import { NextRequest, NextResponse } from "next/server";
import { vacateExpiredContractRooms } from "@/lib/vacateExpiredRooms";

/** Vercel Cron hits this daily. See vacateExpiredContractRooms for the actual logic. */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ success: false, message: "unauthorized" }, { status: 401 });
  }

  const result = await vacateExpiredContractRooms();
  return NextResponse.json({ success: true, ...result });
}
