import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { serialize } from "@/lib/serialize";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "BOSS")) {
    return NextResponse.json({ success: false, message: "没有权限查看" }, { status: 403 });
  }

  const requests = await prisma.maintenanceRequest.findMany({
    orderBy: { createdAt: "desc" },
    include: { contract: { select: { contractCode: true } } },
  });

  return NextResponse.json({ success: true, requests: serialize(requests) });
}
