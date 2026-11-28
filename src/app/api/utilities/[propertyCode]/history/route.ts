import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { findUnit, unitHistory } from "@/lib/utilityBilling";

/** GET /api/utilities/PXC/history — the unit's last 12 billed months (Boss / Admin). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ propertyCode: string }> }) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "BOSS" && user.role !== "ADMIN")) {
    return NextResponse.json({ success: false, message: "没有权限" }, { status: 403 });
  }
  const { propertyCode } = await params;
  const unit = await findUnit(propertyCode);
  if (!unit) return NextResponse.json({ success: false, message: "找不到这个单位" }, { status: 404 });
  return NextResponse.json({ success: true, months: await unitHistory(unit.id) });
}
