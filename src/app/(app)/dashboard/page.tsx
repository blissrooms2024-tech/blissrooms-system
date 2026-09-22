import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (session.role !== "BOSS" && session.role !== "ADMIN") redirect("/rooms");

  const rooms = await prisma.room.groupBy({ by: ["status", "isCarpark"], _count: true });
  const roomCounts: Record<string, number> = { VACANT: 0, OCCUPIED: 0, RESERVED: 0, MAINTENANCE: 0, STORE: 0 };
  const carparkCounts: Record<string, number> = { VACANT: 0, OCCUPIED: 0, RESERVED: 0, MAINTENANCE: 0, STORE: 0 };
  for (const r of rooms) {
    const target = r.isCarpark ? carparkCounts : roomCounts;
    target[r.status] = r._count;
  }

  // STORE rooms aren't rentable, so they're shown as their own box and left out of the
  // occupancy total/rate — otherwise they'd silently drag the occupancy rate down.
  function buildBoxes(counts: Record<string, number>) {
    const total = counts.VACANT + counts.OCCUPIED + counts.RESERVED + counts.MAINTENANCE;
    const rate = total ? Math.round((counts.OCCUPIED / total) * 100) : 0;
    return [
      { n: counts.VACANT, l: "空房", lEn: "Vacant" },
      { n: counts.OCCUPIED, l: "已出租", lEn: "Occupied" },
      { n: counts.RESERVED, l: "已订", lEn: "Reserved" },
      { n: counts.MAINTENANCE, l: "维修中", lEn: "Maintenance" },
      { n: counts.STORE, l: "储藏室", lEn: "Storage" },
      { n: `${rate}%`, l: "出租率", lEn: "Occupancy Rate" },
    ];
  }

  function fmtRM(v: unknown) {
    return `RM${Number(v ?? 0).toLocaleString()}`;
  }

  const roomBoxes = buildBoxes(roomCounts);
  const carparkBoxes = buildBoxes(carparkCounts);

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  const [revenueAll, revenueYear, revenueMonth, agents, contractCounts, monthContractCounts] = await Promise.all([
    prisma.payment.aggregate({ where: { status: "Paid" }, _sum: { amountPaid: true } }),
    prisma.payment.aggregate({ where: { status: "Paid", paidDate: { gte: startOfYear } }, _sum: { amountPaid: true } }),
    prisma.payment.aggregate({ where: { status: "Paid", paidDate: { gte: startOfMonth } }, _sum: { amountPaid: true } }),
    prisma.user.findMany({ where: { role: "AGENT" }, select: { id: true, userCode: true, name: true } }),
    // Every submitted contract counts as a "sale" — DRAFT is excluded since the agent hasn't
    // actually closed anything yet, but everything past that (even later terminated/expired)
    // was a real deal at the time.
    prisma.contract.groupBy({ by: ["agentId"], where: { status: { not: "DRAFT" } }, _count: true }),
    prisma.contract.groupBy({
      by: ["agentId"],
      where: { status: { not: "DRAFT" }, createdAt: { gte: startOfMonth } },
      _count: true,
    }),
  ]);

  const totalMap = new Map(contractCounts.map((g) => [g.agentId, g._count]));
  const monthMap = new Map(monthContractCounts.map((g) => [g.agentId, g._count]));
  const leaderboard = agents
    .map((a) => ({
      userCode: a.userCode,
      name: a.name,
      total: totalMap.get(a.id) ?? 0,
      thisMonth: monthMap.get(a.id) ?? 0,
    }))
    .filter((a) => a.total > 0)
    .sort((a, b) => b.total - a.total);

  const revBoxes = [
    { n: fmtRM(revenueMonth._sum.amountPaid), l: "本月营业额", lEn: "This Month", href: "/revenue-report?period=month" },
    { n: fmtRM(revenueYear._sum.amountPaid), l: "本年营业额", lEn: "This Year", href: "/revenue-report?period=year" },
    { n: fmtRM(revenueAll._sum.amountPaid), l: "累计总营业额", lEn: "All Time", href: "/revenue-report?period=all" },
  ];

  return (
    <DashboardClient
      revBoxes={revBoxes}
      roomBoxes={roomBoxes}
      carparkBoxes={carparkBoxes}
      leaderboard={leaderboard}
    />
  );
}
