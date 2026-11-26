import { prisma } from "@/lib/prisma";
import { isDepositLiabilityType } from "@/lib/config";

/**
 * Company P&L, per unit and per month.
 *
 * Revenue  = Paid payments by paidDate, excluding deposit-type money (DEPOSIT / UTILITIES /
 *            ACCESS_CARD / CREDIT — held in trust, same rule as the Revenue Report).
 * Costs    = - fixed owner rent for master-leased units, per month the lease runs
 *            - landlord's share for units managed for a landlord (revenue × (1 − fee rate))
 *            - every Expense row, by its periodMonth (running costs, approved staff claims,
 *              maintenance payouts, agent commissions, voucher costs)
 *            - older maintenance payouts / agent commissions paid before those started being
 *              booked as Expense rows ("legacy"), so they're still counted — exactly once.
 * Expenses with no unit are company overhead and come off the company total only.
 */

export const UNASSIGNED = "__UNASSIGNED__";
export const COMPANY = "__COMPANY__";

export type RevenueKey = "RENTAL" | "CARPARK" | "OTHER";
export interface PnlCell {
  revenue: Record<RevenueKey, number>;
  revenueTotal: number;
  ownerRent: number;
  landlordShare: number;
  expenses: Record<string, number>;
  legacyMaintenance: number;
  legacyCommission: number;
  costTotal: number;
  net: number;
}

export interface PnlLine {
  key: string;
  label: string;
  /** Which expense / legacy row made this cost (for drill-down). */
  ref: string;
  date: string;
  amount: number;
  notes: string | null;
}

function emptyCell(): PnlCell {
  return {
    revenue: { RENTAL: 0, CARPARK: 0, OTHER: 0 },
    revenueTotal: 0,
    ownerRent: 0,
    landlordShare: 0,
    expenses: {},
    legacyMaintenance: 0,
    legacyCommission: 0,
    costTotal: 0,
    net: 0,
  };
}

function finish(c: PnlCell) {
  c.revenueTotal = c.revenue.RENTAL + c.revenue.CARPARK + c.revenue.OTHER;
  const exp = Object.values(c.expenses).reduce((s, n) => s + n, 0);
  c.costTotal = c.ownerRent + c.landlordShare + exp + c.legacyMaintenance + c.legacyCommission;
  c.net = c.revenueTotal - c.costTotal;
  return c;
}

function addInto(a: PnlCell, b: PnlCell) {
  a.revenue.RENTAL += b.revenue.RENTAL;
  a.revenue.CARPARK += b.revenue.CARPARK;
  a.revenue.OTHER += b.revenue.OTHER;
  a.ownerRent += b.ownerRent;
  a.landlordShare += b.landlordShare;
  for (const [k, v] of Object.entries(b.expenses)) a.expenses[k] = (a.expenses[k] ?? 0) + v;
  a.legacyMaintenance += b.legacyMaintenance;
  a.legacyCommission += b.legacyCommission;
}

const monthOf = (d: Date) => d.toISOString().slice(0, 7);

export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let [y, m] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

/** Maintenance request codes / contract codes whose payout already has an Expense row. */
export function bookedLegacyRefs(expenseNotes: { category: string; notes: string | null }[]) {
  const maintenance = new Set<string>();
  const commission = new Set<string>();
  for (const e of expenseNotes) {
    if (!e.notes) continue;
    if (e.category === "MAINTENANCE") {
      const m = /报修单 (\S+)/.exec(e.notes);
      if (m) maintenance.add(m[1]);
    } else if (e.category === "COMMISSION") {
      const m = /合同 ([^,，)\s]+)/.exec(e.notes);
      if (m) commission.add(m[1]);
    }
  }
  return { maintenance, commission };
}

export async function computePnl(fromMonth: string, toMonth: string) {
  const months = monthsBetween(fromMonth, toMonth);
  const rangeStart = new Date(`${fromMonth}-01T00:00:00.000Z`);
  const [ty, tm] = toMonth.split("-").map(Number);
  const rangeEnd = new Date(Date.UTC(ty, tm, 1));

  const [properties, rooms, payments, expenses, maintenance, commissions, bookedNotes] = await Promise.all([
    prisma.property.findMany({
      select: {
        id: true,
        propertyCode: true,
        name: true,
        status: true,
        createdAt: true,
        ownerRentalAmount: true,
        managementFeeRate: true,
        info: { select: { ownerLeaseStart: true, ownerLeaseEnd: true } },
      },
      orderBy: { propertyCode: "asc" },
    }),
    prisma.room.findMany({ select: { roomCode: true, propertyId: true, isCarpark: true } }),
    prisma.payment.findMany({
      where: { status: "Paid", paidDate: { gte: rangeStart, lt: rangeEnd } },
      select: { roomCode: true, type: true, amountPaid: true, paidDate: true, contract: { select: { carparkRoomId: true } } },
    }),
    prisma.expense.findMany({
      where: { periodMonth: { in: months } },
      select: {
        expenseCode: true,
        propertyId: true,
        category: true,
        customLabel: true,
        amount: true,
        periodMonth: true,
        expenseDate: true,
        notes: true,
        room: { select: { roomCode: true } },
      },
      orderBy: { expenseDate: "asc" },
    }),
    prisma.maintenanceRequest.findMany({
      where: { cost: { not: null }, costPaidAt: { gte: rangeStart, lt: rangeEnd } },
      select: { requestCode: true, roomCode: true, title: true, cost: true, costPaidAt: true },
    }),
    prisma.contract.findMany({
      where: { commStatus: "Paid", commAmount: { not: null }, commPaidAt: { gte: rangeStart, lt: rangeEnd } },
      select: { contractCode: true, commAmount: true, commPaidAt: true, agentName: true, room: { select: { propertyId: true } } },
    }),
    prisma.expense.findMany({
      where: { category: { in: ["MAINTENANCE", "COMMISSION"] } },
      select: { category: true, notes: true },
    }),
  ]);

  const booked = bookedLegacyRefs(bookedNotes);
  const roomInfo = new Map(rooms.map((r) => [r.roomCode, r]));
  const propById = new Map(properties.map((p) => [p.id, p]));

  // cells[unitKey][month]
  const cells = new Map<string, Map<string, PnlCell>>();
  const cell = (unit: string, month: string) => {
    let byMonth = cells.get(unit);
    if (!byMonth) cells.set(unit, (byMonth = new Map()));
    let c = byMonth.get(month);
    if (!c) byMonth.set(month, (c = emptyCell()));
    return c;
  };
  const lines = new Map<string, PnlLine[]>();
  const addLine = (unit: string, line: PnlLine) => {
    if (!lines.has(unit)) lines.set(unit, []);
    lines.get(unit)!.push(line);
  };

  // Revenue
  for (const p of payments) {
    if (!p.paidDate || isDepositLiabilityType(p.type)) continue;
    const room = roomInfo.get(p.roomCode);
    const unit = room?.propertyId ?? UNASSIGNED;
    const key: RevenueKey = p.type === "RENTAL" ? (room?.isCarpark ? "CARPARK" : "RENTAL") : p.type === "CARPARK" ? "CARPARK" : "OTHER";
    cell(unit, monthOf(p.paidDate)).revenue[key] += Number(p.amountPaid);
  }

  // Owner rent (master lease), only for months the lease is running
  const nowMonth = monthOf(new Date());
  for (const p of properties) {
    if (p.ownerRentalAmount === null) continue;
    const start = p.info?.ownerLeaseStart ? monthOf(p.info.ownerLeaseStart) : monthOf(p.createdAt);
    const end = p.info?.ownerLeaseEnd ? monthOf(p.info.ownerLeaseEnd) : p.status === "Inactive" ? null : "9999-12";
    if (!end) continue;
    for (const m of months) {
      if (m < start || m > end || m > nowMonth) continue;
      cell(p.id, m).ownerRent += Number(p.ownerRentalAmount);
    }
  }

  // Expenses (incl. approved claims, maintenance/commission/voucher payouts)
  for (const e of expenses) {
    const unit = e.propertyId ?? COMPANY;
    const c = cell(unit, e.periodMonth);
    c.expenses[e.category] = (c.expenses[e.category] ?? 0) + Number(e.amount);
    addLine(unit, {
      key: e.category,
      label: e.customLabel ?? "",
      ref: e.expenseCode + (e.room ? ` · ${e.room.roomCode}` : ""),
      date: e.expenseDate.toISOString().slice(0, 10),
      amount: Number(e.amount),
      notes: e.notes,
    });
  }

  // Legacy maintenance payouts not yet booked as expenses
  for (const m of maintenance) {
    if (!m.costPaidAt || booked.maintenance.has(m.requestCode)) continue;
    const unit = roomInfo.get(m.roomCode)?.propertyId ?? UNASSIGNED;
    cell(unit, monthOf(m.costPaidAt)).legacyMaintenance += Number(m.cost);
    addLine(unit, {
      key: "LEGACY_MAINTENANCE",
      label: m.title,
      ref: `${m.requestCode} · ${m.roomCode}`,
      date: m.costPaidAt.toISOString().slice(0, 10),
      amount: Number(m.cost),
      notes: null,
    });
  }

  // Legacy commissions not yet booked as expenses
  for (const c of commissions) {
    if (!c.commPaidAt || booked.commission.has(c.contractCode)) continue;
    const unit = c.room.propertyId ?? UNASSIGNED;
    cell(unit, monthOf(c.commPaidAt)).legacyCommission += Number(c.commAmount);
    addLine(unit, {
      key: "LEGACY_COMMISSION",
      label: c.agentName,
      ref: c.contractCode,
      date: c.commPaidAt.toISOString().slice(0, 10),
      amount: Number(c.commAmount),
      notes: null,
    });
  }

  // Landlord share for managed units (computed after revenue is known)
  for (const p of properties) {
    if (p.ownerRentalAmount !== null || p.managementFeeRate === null) continue;
    const byMonth = cells.get(p.id);
    if (!byMonth) continue;
    for (const c of byMonth.values()) {
      const rev = c.revenue.RENTAL + c.revenue.CARPARK + c.revenue.OTHER;
      c.landlordShare = rev * (1 - Number(p.managementFeeRate));
    }
  }

  // Roll up
  const unitKeys = [
    ...properties.map((p) => p.id).filter((id) => cells.has(id) || propById.get(id)?.status !== "Inactive"),
    ...(cells.has(UNASSIGNED) ? [UNASSIGNED] : []),
  ];
  const units = unitKeys.map((key) => {
    const total = emptyCell();
    for (const m of months) {
      const c = cells.get(key)?.get(m);
      if (c) addInto(total, c);
    }
    finish(total);
    const p = propById.get(key);
    return {
      key,
      propertyCode: p?.propertyCode ?? null,
      name: p?.name ?? null,
      kind: p ? (p.ownerRentalAmount !== null ? "LEASED" : p.managementFeeRate !== null ? "MANAGED" : "OWNED") : "UNASSIGNED",
      ...total,
      lines: (lines.get(key) ?? []).sort((a, b) => a.date.localeCompare(b.date)),
    };
  });

  const overhead = emptyCell();
  for (const m of months) {
    const c = cells.get(COMPANY)?.get(m);
    if (c) addInto(overhead, c);
  }
  finish(overhead);

  const unitsTotal = emptyCell();
  for (const u of units) addInto(unitsTotal, u);
  finish(unitsTotal);

  // Month-by-month company totals (for the trend table/chart)
  const trend = months.map((m) => {
    const t = emptyCell();
    for (const byMonth of cells.values()) {
      const c = byMonth.get(m);
      if (c) addInto(t, c);
    }
    finish(t);
    return { month: m, revenue: t.revenueTotal, cost: t.costTotal, net: t.net };
  });

  return {
    months,
    units,
    unitsTotal,
    overhead: { ...overhead, lines: (lines.get(COMPANY) ?? []).sort((a, b) => a.date.localeCompare(b.date)) },
    companyNet: unitsTotal.net - overhead.costTotal,
    trend,
  };
}
