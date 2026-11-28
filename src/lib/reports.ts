import { prisma } from "@/lib/prisma";
import { computePnl } from "@/lib/pnl";
import { addMonths, myDay, periodOf } from "@/lib/bills";

/**
 * Home-page reports for a chosen month and a chosen year: revenue / costs / net profit (same
 * numbers as the P&L page), every month's costs broken down by kind, and sales (contracts).
 */

const sumObj = (rows: Record<string, number>[]) => {
  const out: Record<string, number> = {};
  for (const r of rows) for (const [k, v] of Object.entries(r)) out[k] = (out[k] ?? 0) + v;
  return out;
};

export function currentPeriod() {
  return periodOf(myDay());
}

export async function getReports(month: string, year: number) {
  const curP = currentPeriod();
  const prevP = addMonths(month, -1);
  const yearStart = `${year}-01`;
  const yearEnd = `${year}-12` < curP ? `${year}-12` : curP;
  const monthStart = new Date(`${month}-01T00:00:00.000Z`);
  const monthEnd = new Date(`${addMonths(month, 1)}-01T00:00:00.000Z`);
  const yStart = new Date(`${year}-01-01T00:00:00.000Z`);
  const yEnd = new Date(`${year + 1}-01-01T00:00:00.000Z`);

  const [monthPnl, yearPnl, agents, salesTotal, salesYear, salesMonth, firstContract, firstPayment] = await Promise.all([
    computePnl(prevP, month),
    yearStart <= yearEnd ? computePnl(yearStart, yearEnd) : Promise.resolve(null),
    prisma.user.findMany({ where: { role: "AGENT" }, select: { id: true, name: true } }),
    // Same definition as the old leaderboard: every non-draft contract counts as a deal.
    prisma.contract.groupBy({ by: ["agentId"], where: { status: { not: "DRAFT" } }, _count: true }),
    prisma.contract.groupBy({ by: ["agentId"], where: { status: { not: "DRAFT" }, createdAt: { gte: yStart, lt: yEnd } }, _count: true }),
    prisma.contract.groupBy({ by: ["agentId"], where: { status: { not: "DRAFT" }, createdAt: { gte: monthStart, lt: monthEnd } }, _count: true }),
    prisma.contract.aggregate({ _min: { createdAt: true } }),
    prisma.payment.aggregate({ _min: { paidDate: true } }),
  ]);

  const pick = (p: string) =>
    monthPnl.trend.find((t) => t.month === p) ?? { month: p, revenue: 0, cost: 0, net: 0, revenueBy: { RENTAL: 0, CARPARK: 0, OTHER: 0 }, costs: {} };

  const months = yearPnl?.trend ?? [];
  const yearTotals = {
    revenue: months.reduce((s, m) => s + m.revenue, 0),
    cost: months.reduce((s, m) => s + m.cost, 0),
    net: months.reduce((s, m) => s + m.net, 0),
  };

  const agentName = new Map(agents.map((a) => [a.id, a.name]));
  const yearMap = new Map(salesYear.map((g) => [g.agentId, g._count]));
  const monthMap = new Map(salesMonth.map((g) => [g.agentId, g._count]));
  const leaderboard = salesTotal
    .filter((g) => agentName.has(g.agentId))
    .map((g) => ({ name: agentName.get(g.agentId)!, total: g._count, year: yearMap.get(g.agentId) ?? 0, month: monthMap.get(g.agentId) ?? 0 }))
    .sort((a, b) => b.month - a.month || b.year - a.year || b.total - a.total)
    .slice(0, 5);
  const count = (gs: { _count: number }[]) => gs.reduce((s, g) => s + g._count, 0);

  const firstYear = Math.min(
    ...[firstContract._min.createdAt, firstPayment._min.paidDate].filter((d): d is Date => !!d).map((d) => d.getUTCFullYear()),
    Number(curP.slice(0, 4))
  );

  return {
    currentMonth: curP,
    firstYear,
    month: { ...pick(month), previous: pick(prevP) },
    year: {
      year,
      toDate: yearEnd < `${year}-12`,
      throughMonth: yearEnd,
      totals: yearTotals,
      months,
      costTotals: sumObj(months.map((m) => m.costs)),
    },
    sales: { month: count(salesMonth), year: count(salesYear), leaderboard },
  };
}

export type ReportsData = Awaited<ReturnType<typeof getReports>>;
