import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { runMonthlyRentJob } from "@/lib/monthlyRentJob";

/** Admin-triggered catch-up for the scheduled monthly-rent cron — same job, same idempotency
 * (safe to click even if the cron already ran this month, it just creates nothing new), for
 * whenever the automatic run was missed or Admin wants this month's bills out immediately. */
export async function POST() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ success: false, message: "只有 Admin 可以手动生成" }, { status: 403 });
  }

  const result = await runMonthlyRentJob(`Admin (${user.name}) - 手动生成`);
  const message = `✅ 已生成 ${result.periodMonth} 房租账单: 房租 ${result.rentalCreated} 笔, 车位 ${result.carparkCreated} 笔${
    result.skippedExpiring || result.skippedUnverified
      ? ` (跳过: ${result.skippedExpiring} 份快到期, ${result.skippedUnverified} 份租客未验证)`
      : ""
  }`;

  return NextResponse.json({ success: true, message, ...result });
}
