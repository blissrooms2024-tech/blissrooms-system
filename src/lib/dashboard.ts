import { prisma } from "@/lib/prisma";
import { computePnl } from "@/lib/pnl";
import { addMonths, getBillReminders, myDay, periodOf } from "@/lib/bills";
import { RULES } from "@/lib/config";

/** Everything the Boss/Admin home page shows, in one call. */

const DAY_MS = 24 * 3600 * 1000;
const OPEN_MAINTENANCE = ["SUBMITTED", "ACKNOWLEDGED", "IN_PROGRESS", "PENDING_REVIEW"] as const;
const MOVE_IN_AHEAD_DAYS = 14;
const MOVE_IN_LATE_DAYS = 7;

const daysBetween = (from: Date, to: Date) => Math.round((myDay(to).getTime() - myDay(from).getTime()) / DAY_MS);

export async function getDashboardData(viewer: { id: string; role: string }) {
  const today = myDay();
  const curP = periodOf(today);
  const prevP = addMonths(curP, -1);
  const year = curP.slice(0, 4);
  const fromP = prevP < `${year}-01` ? prevP : `${year}-01`;
  const startOfMonth = new Date(`${curP}-01T00:00:00.000Z`);
  const startOfYear = new Date(`${year}-01-01T00:00:00.000Z`);
  // Date.UTC rolls an impossible day (e.g. 31 Feb) into the next month instead of failing.
  const expiryCutoff = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + RULES.NOTICE_MONTHS, today.getUTCDate()));
  const expiryHideBefore = new Date(today.getTime() - RULES.RENEWAL_LIST_HIDE_AFTER_DAYS * DAY_MS);

  const [
    pnl,
    roomGroups,
    activeTenantRows,
    expiring,
    moveInCandidates,
    openMaintenance,
    bills,
    agents,
    salesTotal,
    salesYear,
    salesMonth,
    pendingReview,
    pendingApprove,
    pendingUsers,
    overdueBills,
    claimGroups,
    activity,
  ] = await Promise.all([
    computePnl(fromP, curP),
    prisma.room.groupBy({ by: ["status", "isCarpark"], _count: true }),
    prisma.contract.findMany({
      where: { status: { in: ["ACTIVE", "EXPIRING"] } },
      select: { tenantId: true, tenantName: true },
    }),
    prisma.contract.findMany({
      where: {
        status: { in: ["ACTIVE", "EXPIRING"] },
        expiredDate: { gte: expiryHideBefore, lte: expiryCutoff },
      },
      select: {
        contractCode: true,
        tenantName: true,
        expiredDate: true,
        moveOutNoticeDate: true,
        renewalRequestedAt: true,
        room: { select: { roomCode: true } },
      },
      orderBy: { expiredDate: "asc" },
    }),
    prisma.contract.findMany({
      where: {
        status: { in: ["PENDING_APPROVE", "PENDING_SIGN", "ACTIVE"] },
        moveForms: { none: { type: "MOVE_IN" } },
        OR: [
          { moveInDate: { gte: new Date(today.getTime() - MOVE_IN_LATE_DAYS * DAY_MS), lte: new Date(today.getTime() + MOVE_IN_AHEAD_DAYS * DAY_MS) } },
          {
            moveInDate: null,
            commencementDate: { gte: new Date(today.getTime() - MOVE_IN_LATE_DAYS * DAY_MS), lte: new Date(today.getTime() + MOVE_IN_AHEAD_DAYS * DAY_MS) },
          },
        ],
      },
      select: {
        contractCode: true,
        tenantName: true,
        status: true,
        moveInDate: true,
        commencementDate: true,
        contactNumber: true,
        room: { select: { roomCode: true } },
      },
    }),
    prisma.maintenanceRequest.findMany({
      where: { status: { in: [...OPEN_MAINTENANCE] } },
      select: {
        requestCode: true,
        roomCode: true,
        title: true,
        status: true,
        assignedTo: true,
        createdAt: true,
        updatedAt: true,
        contract: { select: { room: { select: { property: { select: { propertyCode: true, name: true } } } } } },
      },
      orderBy: { createdAt: "asc" },
    }),
    getBillReminders(),
    prisma.user.findMany({ where: { role: "AGENT" }, select: { id: true, name: true } }),
    // Same definition as the old leaderboard: every non-draft contract counts as a deal.
    prisma.contract.groupBy({ by: ["agentId"], where: { status: { not: "DRAFT" } }, _count: true }),
    prisma.contract.groupBy({ by: ["agentId"], where: { status: { not: "DRAFT" }, createdAt: { gte: startOfYear } }, _count: true }),
    prisma.contract.groupBy({ by: ["agentId"], where: { status: { not: "DRAFT" }, createdAt: { gte: startOfMonth } }, _count: true }),
    prisma.payment.count({ where: { status: "PENDING_REVIEW" } }),
    prisma.contract.count({ where: { status: "PENDING_APPROVE" } }),
    prisma.user.count({ where: { status: "PENDING" } }),
    prisma.payment.aggregate({
      where: { status: { in: ["PENDING", "REJECTED"] }, dueDate: { lt: today } },
      _count: true,
      _sum: { amountDue: true },
    }),
    prisma.expenseClaim.groupBy({
      by: ["status"],
      where: { status: { in: ["PENDING", "APPROVED"] }, submittedById: { not: viewer.id } },
      _count: { _all: true },
      _sum: { amount: true },
    }),
    prisma.activityLog.findMany({ orderBy: { createdAt: "desc" }, take: 12 }),
  ]);

  // --- Reports -----------------------------------------------------------------------------
  const pick = (p: string) => pnl.trend.find((t) => t.month === p) ?? { month: p, revenue: 0, cost: 0, net: 0 };
  const ytd = pnl.trend
    .filter((t) => t.month.startsWith(year))
    .reduce((s, t) => ({ revenue: s.revenue + t.revenue, cost: s.cost + t.cost, net: s.net + t.net }), { revenue: 0, cost: 0, net: 0 });

  const agentName = new Map(agents.map((a) => [a.id, a.name]));
  const yearMap = new Map(salesYear.map((g) => [g.agentId, g._count]));
  const monthMap = new Map(salesMonth.map((g) => [g.agentId, g._count]));
  const leaderboard = salesTotal
    .filter((g) => agentName.has(g.agentId))
    .map((g) => ({
      name: agentName.get(g.agentId)!,
      total: g._count,
      thisYear: yearMap.get(g.agentId) ?? 0,
      thisMonth: monthMap.get(g.agentId) ?? 0,
    }))
    .sort((a, b) => b.thisMonth - a.thisMonth || b.thisYear - a.thisYear || b.total - a.total)
    .slice(0, 5);
  const sumCounts = (gs: { _count: number }[]) => gs.reduce((s, g) => s + g._count, 0);

  // --- Rooms -------------------------------------------------------------------------------
  const blank = () => ({ VACANT: 0, OCCUPIED: 0, RESERVED: 0, MAINTENANCE: 0, STORE: 0 } as Record<string, number>);
  const rc = blank();
  const cc = blank();
  for (const g of roomGroups) (g.isCarpark ? cc : rc)[g.status] = g._count;
  // STORE isn't rentable, so it's left out of the total and the occupancy rate.
  const rentable = (c: Record<string, number>) => c.VACANT + c.OCCUPIED + c.RESERVED + c.MAINTENANCE;
  const tenantKeys = new Set(activeTenantRows.map((r) => r.tenantId ?? `name:${r.tenantName}`));

  const renewedFrom = expiring.length
    ? new Set(
        (
          await prisma.contract.findMany({
            where: { renewedFromContractId: { in: expiring.map((c) => c.contractCode) } },
            select: { renewedFromContractId: true },
          })
        ).map((c) => c.renewedFromContractId)
      )
    : new Set<string | null>();
  const expiringList = expiring
    .filter((c) => !renewedFrom.has(c.contractCode))
    .map((c) => ({
      contractCode: c.contractCode,
      roomCode: c.room.roomCode,
      tenantName: c.tenantName,
      expiredDate: c.expiredDate!.toISOString().slice(0, 10),
      daysLeft: daysBetween(today, c.expiredDate!),
      state: c.renewalRequestedAt ? "RENEW_REQUESTED" : c.moveOutNoticeDate ? "MOVING_OUT" : "UNDECIDED",
    }));

  // --- To-do -------------------------------------------------------------------------------
  const moveIns = moveInCandidates
    .map((c) => {
      const d = (c.moveInDate ?? c.commencementDate)!;
      return {
        contractCode: c.contractCode,
        roomCode: c.room.roomCode,
        tenantName: c.tenantName,
        contactNumber: c.contactNumber,
        status: c.status,
        date: d.toISOString().slice(0, 10),
        daysUntil: daysBetween(today, d),
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  const maintenanceByUnit = new Map<
    string,
    { propertyCode: string; name: string; items: { requestCode: string; roomCode: string; title: string; status: string; assignedTo: string | null; daysOpen: number; daysIdle: number }[] }
  >();
  for (const m of openMaintenance) {
    const p = m.contract.room.property;
    const key = p?.propertyCode ?? "-";
    if (!maintenanceByUnit.has(key)) maintenanceByUnit.set(key, { propertyCode: key, name: p?.name ?? "", items: [] });
    maintenanceByUnit.get(key)!.items.push({
      requestCode: m.requestCode,
      roomCode: m.roomCode,
      title: m.title,
      status: m.status,
      assignedTo: m.assignedTo,
      daysOpen: daysBetween(m.createdAt, today),
      daysIdle: daysBetween(m.updatedAt, today),
    });
  }
  const maintenance = Array.from(maintenanceByUnit.values()).sort(
    (a, b) => Math.max(...b.items.map((i) => i.daysOpen)) - Math.max(...a.items.map((i) => i.daysOpen))
  );

  const claimSum = (s: string) => {
    const g = claimGroups.find((x) => x.status === s);
    return { count: g?._count._all ?? 0, amount: Number(g?._sum.amount ?? 0) };
  };

  return {
    today: today.toISOString().slice(0, 10),
    reports: {
      thisMonth: pick(curP),
      lastMonth: pick(prevP),
      ytd,
      year,
      sales: { thisMonth: sumCounts(salesMonth), thisYear: sumCounts(salesYear), leaderboard },
    },
    rooms: {
      total: rentable(rc),
      occupied: rc.OCCUPIED,
      vacant: rc.VACANT,
      reserved: rc.RESERVED,
      maintenance: rc.MAINTENANCE,
      store: rc.STORE,
      occupancyRate: rentable(rc) ? rc.OCCUPIED / rentable(rc) : 0,
      carparks: { total: rentable(cc), vacant: cc.VACANT, occupied: cc.OCCUPIED },
      tenants: tenantKeys.size,
      expiring: expiringList,
    },
    todo: {
      pendingReview,
      pendingApprove,
      pendingUsers,
      overdueBills: { count: overdueBills._count, amount: Number(overdueBills._sum.amountDue ?? 0) },
      moveIns,
      maintenance,
      maintenanceCount: openMaintenance.length,
      maintenanceToClose: openMaintenance.filter((m) => m.status === "PENDING_REVIEW").length,
      bills,
    },
    claims: { pending: claimSum("PENDING"), toPay: claimSum("APPROVED") },
    activity: activity.map((a) => ({
      id: a.id,
      at: a.createdAt.toISOString(),
      userName: a.userName,
      role: a.role,
      method: a.method,
      area: a.area,
      target: a.target,
      summary: a.summary,
    })),
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
