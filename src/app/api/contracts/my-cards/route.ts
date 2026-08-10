import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ success: false, message: "请重新登录" }, { status: 401 });
  if (user.role !== "TENANT") {
    return NextResponse.json({ success: false, message: "只有租客可以看" }, { status: 403 });
  }

  const contracts = await prisma.contract.findMany({
    where: { tenantId: user.sub },
    orderBy: { createdAt: "desc" },
    include: { room: { select: { roomCode: true } } },
  });

  const [paidGroups, moveForms] = await Promise.all([
    prisma.payment.groupBy({
      by: ["contractId"],
      where: { contractId: { in: contracts.map((c) => c.id) } },
      _sum: { amountPaid: true },
    }),
    prisma.moveInOutForm.findMany({
      where: { contractId: { in: contracts.map((c) => c.id) } },
      select: { contractId: true, type: true },
    }),
  ]);

  const paidMap = new Map(paidGroups.map((g) => [g.contractId, Number(g._sum.amountPaid ?? 0)]));
  const moveSet = new Set(moveForms.map((m) => `${m.contractId}_${m.type}`));

  const cards = contracts.map((c) => {
    const paid = paidMap.get(c.id) ?? 0;
    const outstanding = Math.max(Number(c.totalOutstanding) - paid, 0);
    const daysToExpiry = c.expiredDate
      ? Math.ceil((new Date(c.expiredDate).getTime() - Date.now()) / (24 * 3600 * 1000))
      : null;
    return {
      contractCode: c.contractCode,
      roomCode: c.room.roomCode,
      status: c.status,
      totalOutstanding: Number(c.totalOutstanding),
      paid,
      outstanding,
      agentSigned: !!c.agentSignature,
      tenantSigned: !!c.tenantSignature,
      hasICFront: !!c.icFront,
      hasICBack: !!c.icBack,
      moveInDone: moveSet.has(`${c.id}_MOVE_IN`),
      moveOutDone: moveSet.has(`${c.id}_MOVE_OUT`),
      daysToExpiry,
    };
  });

  return NextResponse.json({ success: true, cards });
}
