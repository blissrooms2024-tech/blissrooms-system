import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";

/** Powers the yellow (open count) / teal (newly completed) badges on the tenant sidebar's
 * 报修 link — cheap enough to poll from AppShell on every navigation. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "TENANT") {
    return NextResponse.json({ success: false, message: "只有租客可以看" }, { status: 403 });
  }

  const [openCount, lastCompleted] = await Promise.all([
    prisma.maintenanceRequest.count({
      where: { tenantId: user.sub, status: { in: ["SUBMITTED", "ACKNOWLEDGED", "IN_PROGRESS"] } },
    }),
    prisma.maintenanceRequest.findFirst({
      where: { tenantId: user.sub, status: "COMPLETED" },
      orderBy: { resolvedAt: "desc" },
      select: { resolvedAt: true },
    }),
  ]);

  return NextResponse.json({
    success: true,
    openCount,
    latestResolvedAt: lastCompleted?.resolvedAt?.toISOString() ?? null,
  });
}
