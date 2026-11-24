import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { serialize } from "@/lib/serialize";

/** Every contract with a commission amount on file, for the Admin-only 💰 Agent 佣金 page —
 * entering the amount (Edit Contract) and actually paying it out (here) are kept separate, so
 * this is the one place Admin sees everything owed/paid across every agent at once instead of
 * having to open each contract individually. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "BOSS")) {
    return NextResponse.json({ success: false, message: "没有权限" }, { status: 403 });
  }

  const contracts = await prisma.contract.findMany({
    where: { commAmount: { not: null } },
    orderBy: { createdAt: "desc" },
    include: { room: { select: { roomCode: true } }, agent: { select: { name: true, userCode: true } } },
  });

  return NextResponse.json({
    success: true,
    contracts: serialize(
      contracts.map((c) => ({
        contractCode: c.contractCode,
        roomCode: c.room.roomCode,
        tenantName: c.tenantName,
        agentName: c.agent.name,
        agentUserCode: c.agent.userCode,
        commAmount: c.commAmount,
        commStatus: c.commStatus,
        commPaidAt: c.commPaidAt,
      }))
    ),
  });
}
