import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";

/** Agent's own detailed contract report — same period-switcher pattern as the company-wide
 * 营业额报告, but scoped to just this agent's deals. */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "AGENT") {
    return NextResponse.json({ success: false, message: "只有 Agent 可以看" }, { status: 403 });
  }

  const period = req.nextUrl.searchParams.get("period") || "all";
  const now = new Date();

  let rangeStart: Date | null = null;
  let rangeEnd: Date | null = null;
  let month = "";
  let year = now.getFullYear();

  if (period === "month") {
    month = req.nextUrl.searchParams.get("month") || now.toISOString().slice(0, 7);
    const m = /^(\d{4})-(\d{2})$/.exec(month);
    if (!m) return NextResponse.json({ success: false, message: "月份格式不对, 要 YYYY-MM" }, { status: 400 });
    rangeStart = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1));
    rangeEnd = new Date(Date.UTC(Number(m[1]), Number(m[2]), 1));
  } else if (period === "year") {
    year = Number(req.nextUrl.searchParams.get("year")) || now.getFullYear();
    rangeStart = new Date(Date.UTC(year, 0, 1));
    rangeEnd = new Date(Date.UTC(year + 1, 0, 1));
  } else if (period !== "all") {
    return NextResponse.json({ success: false, message: "period 要是 month / year / all" }, { status: 400 });
  }

  const myContracts = await prisma.contract.findMany({
    where: {
      agentId: user.sub,
      status: { not: "DRAFT" },
      ...(rangeStart && rangeEnd ? { createdAt: { gte: rangeStart, lt: rangeEnd } } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: { room: { select: { roomCode: true } } },
  });

  const depositPaidGroups = myContracts.length
    ? await prisma.payment.groupBy({
        by: ["contractId"],
        where: { contractId: { in: myContracts.map((c) => c.id) }, status: "Paid", type: "DEPOSIT" },
        _sum: { amountPaid: true },
      })
    : [];
  const depositPaidMap = new Map(depositPaidGroups.map((g) => [g.contractId, Number(g._sum.amountPaid ?? 0)]));

  const contracts = myContracts.map((c) => {
    const depositPaid = depositPaidMap.get(c.id) ?? 0;
    const depositDue = Number(c.securityDeposit);
    return {
      contractCode: c.contractCode,
      roomCode: c.room.roomCode,
      tenantName: c.tenantName,
      status: c.status,
      createdAt: c.createdAt.toISOString().slice(0, 10),
      commencementDate: c.commencementDate ? c.commencementDate.toISOString().slice(0, 10) : null,
      expiredDate: c.expiredDate ? c.expiredDate.toISOString().slice(0, 10) : null,
      roomRental: Number(c.roomRental),
      carparkRental: Number(c.carparkRental),
      depositOutstanding: Math.max(depositDue - depositPaid, 0),
    };
  });

  const activeContracts = contracts.filter((c) => c.status === "ACTIVE");
  const totalRent = activeContracts.reduce((s, c) => s + c.roomRental + c.carparkRental, 0);

  return NextResponse.json({
    success: true,
    period,
    month,
    year,
    stats: { newContracts: contracts.length, activeRooms: activeContracts.length, totalRent },
    contracts,
  });
}
