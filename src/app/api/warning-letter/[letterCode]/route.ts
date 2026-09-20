import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, type SessionPayload } from "@/lib/auth/session";
import { serialize } from "@/lib/serialize";

function canView(user: SessionPayload, contract: { agentId: string; tenantId: string | null }) {
  if (user.role === "BOSS" || user.role === "ADMIN") return true;
  if (user.role === "AGENT" && contract.agentId === user.sub) return true;
  // Not gated on role === "TENANT": an Agent can also be the tenant on their own contract.
  if (contract.tenantId === user.sub) return true;
  return false;
}

/** Single formal warning letter, for the printable /warning-letter/[letterCode] page. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ letterCode: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ success: false, message: "请重新登录" }, { status: 401 });

  const { letterCode } = await params;
  const letter = await prisma.warningLetter.findUnique({
    where: { letterCode },
    include: { contract: { include: { room: { select: { roomCode: true, isCarpark: true } } } } },
  });
  if (!letter) return NextResponse.json({ success: false, message: "找不到这封信" }, { status: 404 });
  if (!canView(user, letter.contract)) {
    return NextResponse.json({ success: false, message: "没有权限查看这封信" }, { status: 403 });
  }

  return NextResponse.json({
    success: true,
    letter: serialize({
      letterCode: letter.letterCode,
      message: letter.message,
      sentBy: letter.sentBy,
      triggeredBy: letter.triggeredBy,
      createdAt: letter.createdAt,
      contractCode: letter.contract.contractCode,
      tenantName: letter.contract.tenantName,
      tenantIc: letter.contract.tenantIc,
      propertyAddress: letter.contract.propertyAddress,
      roomCode: letter.contract.room.roomCode,
      isCarpark: letter.contract.room.isCarpark,
    }),
  });
}
