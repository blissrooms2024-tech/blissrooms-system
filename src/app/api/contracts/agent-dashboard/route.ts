import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";

/** Agent's own performance dashboard — how many deals closed, which tenants still have
 * something outstanding (signature/IC/move-in/deposit), commission status per contract
 * (Admin fills commAmount/commStatus manually — this only displays it), and where the agent
 * ranks against everyone else. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "AGENT") {
    return NextResponse.json({ success: false, message: "只有 Agent 可以看" }, { status: 403 });
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [myContracts, moveInForms, depositPaidGroups, allAgents, allContractCounts, monthContractCounts] =
    await Promise.all([
      prisma.contract.findMany({
        where: { agentId: user.sub, status: { not: "DRAFT" } },
        orderBy: { createdAt: "desc" },
        include: { room: { select: { roomCode: true } } },
      }),
      prisma.moveInOutForm.findMany({
        where: { contract: { agentId: user.sub }, type: "MOVE_IN" },
        select: { contractId: true },
      }),
      prisma.payment.groupBy({
        by: ["contractId"],
        where: { contract: { agentId: user.sub }, status: "Paid", type: "DEPOSIT" },
        _sum: { amountPaid: true },
      }),
      prisma.user.findMany({ where: { role: "AGENT" }, select: { id: true, userCode: true, name: true } }),
      prisma.contract.groupBy({ by: ["agentId"], where: { status: { not: "DRAFT" } }, _count: true }),
      prisma.contract.groupBy({
        by: ["agentId"],
        where: { status: { not: "DRAFT" }, createdAt: { gte: startOfMonth } },
        _count: true,
      }),
    ]);

  const moveInSet = new Set(moveInForms.map((f) => f.contractId));
  const depositPaidMap = new Map(depositPaidGroups.map((g) => [g.contractId, Number(g._sum.amountPaid ?? 0)]));

  const contracts = myContracts.map((c) => {
    const depositPaid = depositPaidMap.get(c.id) ?? 0;
    const depositDue = Number(c.securityDeposit);
    return {
      contractCode: c.contractCode,
      roomCode: c.room.roomCode,
      tenantName: c.tenantName,
      status: c.status,
      agentSigned: !!c.agentSignature,
      tenantSigned: !!c.tenantSignature,
      icDone: !!c.icFront && !!c.icBack,
      moveInDone: moveInSet.has(c.id),
      depositDue,
      depositPaid,
      depositOutstanding: Math.max(depositDue - depositPaid, 0),
      commAmount: c.commAmount !== null ? Number(c.commAmount) : null,
      commStatus: c.commAmount !== null ? c.commStatus : null,
    };
  });

  const occupiedRooms = contracts.filter((c) => c.status === "ACTIVE").length;
  const thisMonth = myContracts.filter((c) => c.createdAt >= startOfMonth).length;
  const commissionPaid = contracts.filter((c) => c.commStatus === "Paid").reduce((s, c) => s + (c.commAmount ?? 0), 0);
  const commissionPending = contracts
    .filter((c) => c.commAmount !== null && c.commStatus !== "Paid")
    .reduce((s, c) => s + (c.commAmount ?? 0), 0);

  const totalMap = new Map(allContractCounts.map((g) => [g.agentId, g._count]));
  const monthMap = new Map(monthContractCounts.map((g) => [g.agentId, g._count]));
  const leaderboard = allAgents
    .map((a) => ({
      userCode: a.userCode,
      name: a.name,
      total: totalMap.get(a.id) ?? 0,
      thisMonth: monthMap.get(a.id) ?? 0,
      isMe: a.id === user.sub,
    }))
    .filter((a) => a.total > 0)
    .sort((a, b) => b.total - a.total);

  return NextResponse.json({
    success: true,
    stats: { totalContracts: contracts.length, thisMonth, occupiedRooms, commissionPaid, commissionPending },
    contracts,
    leaderboard,
  });
}
