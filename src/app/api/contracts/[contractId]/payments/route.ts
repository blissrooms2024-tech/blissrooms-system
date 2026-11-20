import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, type SessionPayload } from "@/lib/auth/session";
import { serialize } from "@/lib/serialize";
import { computeBillBreakdown } from "@/lib/billBreakdown";

function canView(user: SessionPayload, contract: { agentId: string; tenantId: string | null }) {
  if (user.role === "BOSS" || user.role === "ADMIN") return true;
  if (user.role === "AGENT" && contract.agentId === user.sub) return true;
  // Not gated on role === "TENANT": an Agent can also be the tenant on their own contract.
  if (contract.tenantId === user.sub) return true;
  return false;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ contractId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ success: false, message: "请重新登录" }, { status: 401 });

  const { contractId } = await params;
  const c = await prisma.contract.findUnique({
    where: { contractCode: contractId },
    include: { agent: { select: { ic: true } }, room: { select: { hasAircon: true, isCarpark: true } } },
  });
  if (!c) return NextResponse.json({ success: false, message: "找不到合同" }, { status: 404 });
  if (!canView(user, c)) {
    return NextResponse.json({ success: false, message: "没有权限查看这张合同" }, { status: 403 });
  }

  const payments = await prisma.payment.findMany({
    where: { contractId: c.id },
    orderBy: { id: "desc" },
  });

  const { breakdown, totalDue, totalPaid, totalOutstanding } = computeBillBreakdown(c, payments, c.room.isCarpark);

  const { agent, ...contractRest } = c;
  return NextResponse.json({
    success: true,
    contract: serialize({ ...contractRest, agentIc: agent.ic }),
    payments: serialize(payments),
    breakdown,
    totalDue,
    totalPaid,
    totalOutstanding,
  });
}

