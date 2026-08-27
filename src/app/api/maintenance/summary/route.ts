import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";

/** Powers the yellow open-count badge on the Admin/Boss sidebar's 报修 link. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "BOSS")) {
    return NextResponse.json({ success: false, message: "没有权限" }, { status: 403 });
  }

  const openCount = await prisma.maintenanceRequest.count({
    where: { status: { in: ["SUBMITTED", "ACKNOWLEDGED", "IN_PROGRESS"] } },
  });

  return NextResponse.json({ success: true, openCount });
}
