import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { runDeactivateExpiredTenants } from "@/lib/deactivateExpiredTenants";

/** Admin-triggered catch-up for the scheduled deactivate-expired-tenants cron — same job,
 * same idempotency (already-disabled tenants are left alone), for whenever Admin wants to
 * run it immediately instead of waiting for the daily schedule. */
export async function POST() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ success: false, message: "只有 Admin 可以手动执行" }, { status: 403 });
  }

  const result = await runDeactivateExpiredTenants();
  const message =
    result.disabled > 0
      ? `✅ 已停用 ${result.disabled} 个过期租客账号: ${result.details.join("; ")}`
      : "✅ 没有需要停用的账号";

  return NextResponse.json({ success: true, message, ...result });
}
