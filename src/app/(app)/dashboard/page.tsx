import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

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
      { n: counts.VACANT, l: "空房" },
      { n: counts.OCCUPIED, l: "已出租" },
      { n: counts.RESERVED, l: "已订" },
      { n: counts.MAINTENANCE, l: "维修中" },
      { n: counts.STORE, l: "储藏室" },
      { n: `${rate}%`, l: "出租率" },
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
    { n: fmtRM(revenueMonth._sum.amountPaid), l: "本月营业额" },
    { n: fmtRM(revenueYear._sum.amountPaid), l: "本年营业额" },
    { n: fmtRM(revenueAll._sum.amountPaid), l: "累计总营业额" },
  ];
  const MEDAL = ["🥇", "🥈", "🥉"];

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white p-5 shadow-sm">
        <h3 className="mb-3.5 text-base font-semibold text-brand">🏠 房间总览</h3>
        <div className="flex flex-wrap gap-3.5">
          {roomBoxes.map((b) => (
            <div key={b.l} className="min-w-[110px] flex-1 rounded-xl bg-gray-50 p-3.5 text-center">
              <div className="text-2xl font-bold text-brand">{b.n}</div>
              <div className="text-xs text-gray-500">{b.l}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-xl bg-white p-5 shadow-sm">
        <h3 className="mb-3.5 text-base font-semibold text-brand">🅿️ 车位总览</h3>
        <div className="flex flex-wrap gap-3.5">
          {carparkBoxes.map((b) => (
            <div key={b.l} className="min-w-[110px] flex-1 rounded-xl bg-gray-50 p-3.5 text-center">
              <div className="text-2xl font-bold text-brand">{b.n}</div>
              <div className="text-xs text-gray-500">{b.l}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl bg-white p-5 shadow-sm">
        <h3 className="mb-3.5 text-base font-semibold text-brand">💰 营业额</h3>
        <div className="flex flex-wrap gap-3.5">
          {revBoxes.map((b) => (
            <div key={b.l} className="min-w-[140px] flex-1 rounded-xl bg-gray-50 p-3.5 text-center">
              <div className="text-2xl font-bold text-brand">{b.n}</div>
              <div className="text-xs text-gray-500">{b.l}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl bg-white p-5 shadow-sm">
        <h3 className="mb-3.5 text-base font-semibold text-brand">🏆 Top Sales 排行榜</h3>
        {leaderboard.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-400">还没有成交记录</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-gray-600">
                <th className="px-2.5 py-1.5 font-semibold">排名</th>
                <th className="px-2.5 py-1.5 font-semibold">Agent</th>
                <th className="px-2.5 py-1.5 font-semibold">总成交合同</th>
                <th className="px-2.5 py-1.5 font-semibold">本月新增</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((a, i) => (
                <tr key={a.userCode} className="border-b border-gray-100">
                  <td className="px-2.5 py-1.5 font-semibold">{MEDAL[i] ?? `#${i + 1}`}</td>
                  <td className="px-2.5 py-1.5">{a.name}</td>
                  <td className="px-2.5 py-1.5 font-semibold text-brand">{a.total}</td>
                  <td className="px-2.5 py-1.5">{a.thisMonth}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
