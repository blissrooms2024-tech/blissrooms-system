import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { serialize } from "@/lib/serialize";

/** Full warning-letter log across all contracts/tenants, for the Admin/Boss "警告信记录"
 * page — so they don't lose track of who's already been warned when there are many tenants. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "BOSS")) {
    return NextResponse.json({ success: false, message: "没有权限查看" }, { status: 403 });
  }

  const letters = await prisma.warningLetter.findMany({
    orderBy: { createdAt: "desc" },
    include: { contract: { select: { contractCode: true, tenantName: true, roomId: true, room: { select: { roomCode: true } } } } },
  });

  return NextResponse.json({
    success: true,
    letters: serialize(
      letters.map((l) => ({
        letterCode: l.letterCode,
        contractCode: l.contract.contractCode,
        tenantName: l.contract.tenantName,
        roomCode: l.contract.room.roomCode,
        message: l.message,
        sentBy: l.sentBy,
        triggeredBy: l.triggeredBy,
        createdAt: l.createdAt,
      }))
    ),
  });
}
