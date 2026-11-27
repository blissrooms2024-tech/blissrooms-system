import { prisma } from "@/lib/prisma";
import { getReports } from "@/lib/reports";
import { getBillReminders, myDay, periodOf } from "@/lib/bills";
import { getCollection } from "@/lib/collection";
import { RULES } from "@/lib/config";

/** Everything the Boss/Admin home page shows, in one call. */

const DAY_MS = 24 * 3600 * 1000;
const OPEN_MAINTENANCE = ["SUBMITTED", "ACKNOWLEDGED", "IN_PROGRESS", "PENDING_REVIEW"] as const;
export const MOVE_IN_AHEAD_DAYS = 30;
const MOVE_IN_LATE_DAYS = 7;

/** Where a contract that isn't live yet is stuck, in the order the steps have to happen:
 * Admin approves → Agent signs (renewals are company-signed automatically) → tenant uploads
 * both sides of their IC → tenant signs, which makes it ACTIVE. */
export type SignStep = "APPROVE" | "AGENT_SIGN" | "TENANT_IC" | "TENANT_SIGN";

const daysBetween = (from: Date, to: Date) => Math.round((myDay(to).getTime() - myDay(from).getTime()) / DAY_MS);

export async function getDashboardData(viewer: { id: string; role: string }) {
  const today = myDay();
  const curP = periodOf(today);
  const year = curP.slice(0, 4);
  // Date.UTC rolls an impossible day (e.g. 31 Feb) into the next month instead of failing.
  const expiryCutoff = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + RULES.NOTICE_MONTHS, today.getUTCDate()));
  const expiryHideBefore = new Date(today.getTime() - RULES.RENEWAL_LIST_HIDE_AFTER_DAYS * DAY_MS);

  const [
    reports,
    roomGroups,
    activeTenantRows,
    expiring,
    moveInCandidates,
    openMaintenance,
    bills,
    pendingReview,
    pendingApprove,
    pendingUsers,
    overdueBills,
    claimGroups,
    activity,
    outstandingBills,
    signing,
    collection,
    propertyCount,
  ] = await Promise.all([
    getReports(curP, Number(year)),
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
    // Same set as the 未清账单 page, so the number on the home tile matches what it opens.
    prisma.payment.aggregate({
      where: { status: { in: ["PENDING", "PENDING_REVIEW", "REJECTED"] } },
      _count: true,
      _sum: { amountDue: true },
    }),
    prisma.contract.findMany({
      where: { status: { in: ["PENDING_APPROVE", "PENDING_SIGN"] } },
      select: {
        contractCode: true,
        tenantName: true,
        agentName: true,
        status: true,
        agentSignature: true,
        tenantSignature: true,
        icFront: true,
        icBack: true,
        createdAt: true,
        approvedAt: true,
        room: { select: { roomCode: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    getCollection(curP),
    prisma.property.count({ where: { OR: [{ status: null }, { status: { not: "Inactive" } }] } }),
  ]);

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

  // --- Contracts waiting to go live --------------------------------------------------------
  const signingList = signing.map((c) => {
    const step: SignStep =
      c.status === "PENDING_APPROVE" ? "APPROVE" : !c.agentSignature ? "AGENT_SIGN" : !c.icFront || !c.icBack ? "TENANT_IC" : "TENANT_SIGN";
    const since = step === "APPROVE" ? c.createdAt : (c.approvedAt ?? c.createdAt);
    return {
      contractCode: c.contractCode,
      roomCode: c.room.roomCode,
      tenantName: c.tenantName,
      agentName: c.agentName,
      step,
      daysWaiting: Math.max(daysBetween(since, today), 0),
    };
  });

  const countStatus = (...s: string[]) => openMaintenance.filter((m) => s.includes(m.status)).length;

  return {
    today: today.toISOString().slice(0, 10),
    reports,
    collection,
    propertyCount,
    signing: signingList,
    maintenanceStatus: {
      fresh: countStatus("SUBMITTED"),
      working: countStatus("ACKNOWLEDGED", "IN_PROGRESS"),
      toCheck: countStatus("PENDING_REVIEW"),
    },
    outstanding: { count: outstandingBills._count, amount: Number(outstandingBills._sum.amountDue ?? 0) },
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
