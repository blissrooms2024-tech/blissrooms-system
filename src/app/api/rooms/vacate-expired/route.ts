import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { vacateExpiredContractRooms } from "@/lib/vacateExpiredRooms";

/** Admin-triggered manual run of the same logic as the daily cron (/api/cron/vacate-expired-rooms)
 * — lets Admin apply it immediately instead of waiting for the next scheduled run, e.g. right
 * after this feature first ships, when every already-expired contract's room is still stale. */
export async function POST() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ success: false, message: "只有 Admin 可以执行" }, { status: 403 });
  }

  const { vacated } = await vacateExpiredContractRooms();
  return NextResponse.json({
    success: true,
    message: vacated > 0 ? `✅ 已经把 ${vacated} 间房间改回空房` : "✅ 检查完了，没有需要改的房间",
  });
}
