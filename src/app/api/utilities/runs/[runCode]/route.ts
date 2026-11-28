import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { withActivity } from "@/lib/activity";
import { BillingError, voidRun } from "@/lib/utilityBilling";

/** DELETE /api/utilities/runs/UB-0003 — undo a month's usage bills so they can be redone, as
 * long as none has been paid or had a slip uploaded (Admin). */
async function handleDELETE(_req: NextRequest, { params }: { params: Promise<{ runCode: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ success: false, message: "只有 Admin 可以撤销" }, { status: 403 });
  const { runCode } = await params;
  try {
    const run = await voidRun(runCode);
    return NextResponse.json({ success: true, message: `已撤销 ${run.property.propertyCode} ${run.period} 的抄表账单（${runCode}），可以重新开单` });
  } catch (e) {
    if (e instanceof BillingError) return NextResponse.json({ success: false, message: e.message }, { status: 400 });
    throw e;
  }
}

export const DELETE = withActivity(handleDELETE);
