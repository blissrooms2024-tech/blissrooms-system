import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { serialize } from "@/lib/serialize";

/** In-house worker's own assigned jobs — tenant's original report photos are visible (so the
 * worker knows what's wrong), but nothing else about the tenant/contract/billing. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "WORKER") {
    return NextResponse.json({ success: false, message: "只有维修工人可以看" }, { status: 403 });
  }

  const requests = await prisma.maintenanceRequest.findMany({
    where: { assignedWorkerId: user.sub },
    orderBy: { createdAt: "desc" },
    include: { contract: { select: { contractCode: true } } },
  });

  return NextResponse.json({ success: true, requests: serialize(requests) });
}
