import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { fmtMoney } from "@/lib/format";
import { RULES } from "@/lib/config";
import DashboardClient, { type TodoItem } from "./DashboardClient";

const DAY_MS = 24 * 3600 * 1000;

/** "今日待办" — the action queues Admin/Boss would otherwise only find through the sidebar's
 * red dots (hidden behind ☰ on a phone). Each item links straight to the page that clears it;
 * items with a zero count are dropped so the card only ever shows real work. Kept to five
 * items on purpose, so the dashboard doesn't turn back into a wall of numbers. */
async function getTodayTodos(role: string): Promise<TodoItem[]> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  // Same window as the 续约管理 list (renewal-candidates API): inside the notice period, or
  // already expired but not yet past the point where the tenant is assumed to have left.
  const expiryCutoff = new Date(startOfToday);
  expiryCutoff.setMonth(expiryCutoff.getMonth() + RULES.NOTICE_MONTHS);
  const hideOverdueCutoff = new Date(startOfToday.getTime() - RULES.RENEWAL_LIST_HIDE_AFTER_DAYS * DAY_MS);

  const [pendingReview, pendingApprove, overdue, expiring, openMtce, oldestMtce] = await Promise.all([
    prisma.payment.count({ where: { status: "PENDING_REVIEW" } }),
    prisma.contract.count({ where: { status: "PENDING_APPROVE" } }),
    // Unpaid bills past their due date. PENDING_REVIEW is left out — the tenant has already
    // paid and uploaded a slip, so it's waiting on us (item 1), not on them.
    prisma.payment.aggregate({
      where: { status: { in: ["PENDING", "REJECTED"] }, dueDate: { lt: startOfToday } },
      _count: true,
      _sum: { amountDue: true, amountPaid: true },
    }),
    prisma.contract.findMany({
      where: { status: "ACTIVE", expiredDate: { lte: expiryCutoff, gte: hideOverdueCutoff } },
      select: { contractCode: true },
    }),
    prisma.maintenanceRequest.count({ where: { status: { in: ["SUBMITTED", "ACKNOWLEDGED", "IN_PROGRESS"] } } }),
    prisma.maintenanceRequest.findFirst({
      where: { status: { in: ["SUBMITTED", "ACKNOWLEDGED", "IN_PROGRESS"] } },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
  ]);

  // A contract that already has its renewal contract drafted has nothing left to action.
  const alreadyRenewed = expiring.length
    ? await prisma.contract.count({
        where: { renewedFromContractId: { in: expiring.map((c) => c.contractCode) } },
      })
    : 0;
  const expiringCount = expiring.length - alreadyRenewed;

  const overdueAmount = Number(overdue._sum.amountDue ?? 0) - Number(overdue._sum.amountPaid ?? 0);
  const oldestDays = oldestMtce ? Math.floor((Date.now() - oldestMtce.createdAt.getTime()) / DAY_MS) : 0;

  const items: TodoItem[] = [
    {
      key: "review",
      count: pendingReview,
      label: "张交易单等审核",
      labelEn: pendingReview === 1 ? "payment slip to review" : "payment slips to review",
      href: "/payments/review",
      tone: "red",
    },
    {
      key: "approve",
      count: pendingApprove,
      label: "份合同等批准",
      labelEn: pendingApprove === 1 ? "contract to approve" : "contracts to approve",
      href: "/contracts",
      tone: "red",
    },
    {
      key: "overdue",
      count: overdue._count,
      label: "笔账单已逾期",
      labelEn: overdue._count === 1 ? "overdue bill" : "overdue bills",
      sub: fmtMoney(overdueAmount),
      subEn: fmtMoney(overdueAmount),
      href: "/payments/outstanding",
      tone: "red",
    },
    {
      key: "expiring",
      count: expiringCount,
      label: `份合同 ${RULES.NOTICE_MONTHS} 个月内到期`,
      labelEn: `${expiringCount === 1 ? "contract" : "contracts"} expiring within ${RULES.NOTICE_MONTHS} months`,
      // 续约管理 is Admin-only; Boss gets the contract list, which badges these as 快到期.
      href: role === "ADMIN" ? "/contracts/renewal" : "/contracts",
      tone: "amber",
    },
    {
      key: "maintenance",
      count: openMtce,
      label: "单报修未完成",
      labelEn: openMtce === 1 ? "open maintenance request" : "open maintenance requests",
      sub: oldestDays > 0 ? `最久 ${oldestDays} 天` : undefined,
      subEn: oldestDays > 0 ? `oldest ${oldestDays} ${oldestDays === 1 ? "day" : "days"}` : undefined,
      href: "/maintenance",
      tone: "amber",
    },
  ];

  return items.filter((i) => i.count > 0);
}

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
    return fmtMoney(Number(v ?? 0));
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

  const todos = await getTodayTodos(session.role);

  return (
    <DashboardClient
      todos={todos}
      revBoxes={revBoxes}
      roomBoxes={roomBoxes}
      carparkBoxes={carparkBoxes}
      leaderboard={leaderboard}
    />
  );
}
