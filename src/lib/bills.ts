import { prisma } from "@/lib/prisma";

/**
 * Due-bill reminders for the dashboard: utility/WiFi accounts and owner rent that are due
 * within REMIND_DAYS (or already overdue) and haven't been marked paid for that month.
 * All dates are worked out in Malaysia time (UTC+8) so the server's own timezone (UTC on
 * Vercel) never shifts "today" by a day.
 */

export const REMIND_DAYS = 7;
const MY_OFFSET_MS = 8 * 3600 * 1000;
const DAY_MS = 24 * 3600 * 1000;

const pad = (n: number) => String(n).padStart(2, "0");

/** Midnight (as a UTC Date) of the given instant's calendar day in Malaysia. */
export function myDay(instant: Date = new Date()): Date {
  const t = new Date(instant.getTime() + MY_OFFSET_MS);
  return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()));
}

export function periodOf(day: Date): string {
  return `${day.getUTCFullYear()}-${pad(day.getUTCMonth() + 1)}`;
}

export function addMonths(period: string, n: number): string {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return periodOf(d);
}

export function dueDateOf(period: string, dueDay: number): Date {
  const [y, m] = period.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 1, Math.min(dueDay, last)));
}

export const isPeriod = (s: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(s);

export interface DueInfo {
  period: string;
  dueDate: string;
  daysLeft: number;
  overdue: boolean;
}

/**
 * The earliest unpaid billing cycle (previous / current / next month), if it's due within
 * REMIND_DAYS or already overdue. Cycles whose due date falls before `startsAt` (e.g. before the
 * account was added) are ignored so a new account doesn't instantly show as overdue.
 */
export function dueReminder(opts: {
  dueDay: number | null;
  paidPeriod: string | null;
  startsAt?: Date | null;
  includePrevious?: boolean;
  today?: Date;
}): DueInfo | null {
  if (!opts.dueDay) return null;
  const today = myDay(opts.today);
  const start = opts.startsAt ? myDay(opts.startsAt) : null;
  const cur = periodOf(today);
  const cycles = [...(opts.includePrevious ? [addMonths(cur, -1)] : []), cur, addMonths(cur, 1)];
  for (const p of cycles) {
    if (opts.paidPeriod && opts.paidPeriod >= p) continue;
    const due = dueDateOf(p, opts.dueDay);
    if (start && due < start) continue;
    const daysLeft = Math.round((due.getTime() - today.getTime()) / DAY_MS);
    if (daysLeft > REMIND_DAYS) return null;
    return { period: p, dueDate: due.toISOString().slice(0, 10), daysLeft, overdue: daysLeft < 0 };
  }
  return null;
}

export interface BillReminder extends DueInfo {
  kind: "UTILITY" | "OWNER_RENT";
  /** UtilityAccount id, or the propertyCode for owner rent. */
  id: string;
  propertyCode: string;
  propertyName: string;
  utilityType: string | null;
  provider: string | null;
  accountNo: string | null;
  payTo: string | null;
  amount: number | null;
}

const activeProperty = { OR: [{ status: null }, { status: { not: "Inactive" } }] };

export async function getBillReminders(today?: Date): Promise<BillReminder[]> {
  const [utilities, infos] = await Promise.all([
    prisma.utilityAccount.findMany({
      // Auto-debit bills pay themselves — nothing for anyone to do.
      where: { dueDay: { not: null }, autoDebit: false, property: activeProperty },
      include: { property: { select: { propertyCode: true, name: true } } },
    }),
    prisma.propertyInfo.findMany({
      where: { ownerRentDueDay: { not: null }, property: { ownerRentalAmount: { not: null }, ...activeProperty } },
      include: { property: { select: { propertyCode: true, name: true, ownerRentalAmount: true, landlord: true } } },
    }),
  ]);

  const out: BillReminder[] = [];
  for (const u of utilities) {
    const due = dueReminder({ dueDay: u.dueDay, paidPeriod: u.lastPaidPeriod, startsAt: u.createdAt, includePrevious: true, today });
    if (!due) continue;
    out.push({
      ...due,
      kind: "UTILITY",
      id: u.id,
      propertyCode: u.property.propertyCode,
      propertyName: u.property.name,
      utilityType: u.utilityType,
      provider: u.provider,
      accountNo: u.accountNo,
      payTo: u.payTo,
      amount: u.fixedAmount === null ? null : Number(u.fixedAmount),
    });
  }
  for (const i of infos) {
    // Only this month and next: a due day set up mid-lease shouldn't flag last month as unpaid.
    const due = dueReminder({ dueDay: i.ownerRentDueDay, paidPeriod: i.ownerRentPaidPeriod, startsAt: i.ownerLeaseStart, today });
    if (!due) continue;
    out.push({
      ...due,
      kind: "OWNER_RENT",
      id: i.property.propertyCode,
      propertyCode: i.property.propertyCode,
      propertyName: i.property.name,
      utilityType: null,
      provider: i.property.landlord,
      accountNo: null,
      payTo: "OWNER",
      amount: i.property.ownerRentalAmount === null ? null : Number(i.property.ownerRentalAmount),
    });
  }
  return out.sort((a, b) => a.daysLeft - b.daysLeft || a.propertyCode.localeCompare(b.propertyCode));
}

/** Expense category to book a paid utility bill under. */
export function utilityExpenseCategory(utilityType: string): { category: "WATER" | "ELECTRIC" | "WIFI" | "OTHER"; customLabel: string | null } {
  if (utilityType === "WATER") return { category: "WATER", customLabel: null };
  if (utilityType === "ELECTRIC") return { category: "ELECTRIC", customLabel: null };
  if (utilityType === "WIFI") return { category: "WIFI", customLabel: null };
  if (utilityType === "SEWERAGE") return { category: "OTHER", customLabel: "排污费 (IWK)" };
  if (utilityType === "GAS") return { category: "OTHER", customLabel: "煤气费" };
  return { category: "OTHER", customLabel: "其他账单" };
}
