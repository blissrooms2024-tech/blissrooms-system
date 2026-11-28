/**
 * 抄表开单 — who pays what for one unit's metered usage in one month. Pure functions, no
 * database, so the rules can be tested on their own:
 *
 *  - A meter tied to a room (e.g. that room's aircon meter) is billed to whoever lived in that
 *    room that month.
 *  - A shared meter (the unit's electricity meter, the washer + dryer meter) is split among the
 *    tenants living in the unit that month, one share per room. Electricity can instead be split
 *    by headcount; washer + dryer is always per room. Empty rooms don't count as a share.
 *    Someone who moved in or out mid-month still counts as a full share.
 *  - A tenant who is exempt, or whose contract doesn't include that charge, still counts as a
 *    share — the company pays that share, so nobody else's bill goes up.
 *  - Amounts are rounded to the sen per tenant; any rounding leftover is the company's.
 */

export type UtilityKind = "ELECTRIC" | "LAUNDRY" | "AC";
export const UTILITY_KINDS: UtilityKind[] = ["ELECTRIC", "LAUNDRY", "AC"];
/** The Payment type each kind is billed as. */
export const KIND_PAYMENT_TYPE = { ELECTRIC: "ELECTRIC", LAUNDRY: "DRYER", AC: "AC" } as const;
export const KIND_LABELS: Record<UtilityKind, { zh: string; en: string }> = {
  ELECTRIC: { zh: "电费", en: "Electricity" },
  LAUNDRY: { zh: "洗衣烘干", en: "Washer & dryer" },
  AC: { zh: "冷气", en: "Air-con" },
};
/** Starting RM per kWh (what the tenancy agreement states); Admin can change them. */
export const DEFAULT_RATES: Record<UtilityKind, number> = { ELECTRIC: 0.5, LAUNDRY: 0.5, AC: 0.75 };

export type SplitBy = "ROOM" | "PEOPLE";
/** Only the unit's electricity meter follows a headcount split; washer + dryer is always one
 * share per room, and a room's own meter belongs to that room. */
export const splitsByPeople = (kind: UtilityKind, roomId: string | null, splitBy: SplitBy) =>
  splitBy === "PEOPLE" && kind === "ELECTRIC" && !roomId;

export interface MeterUsage {
  meterId: string;
  kind: UtilityKind;
  /** null = shared by everyone living in the unit */
  roomId: string | null;
  roomCode: string | null;
  label: string | null;
  /** kWh used this month */
  usage: number;
  /** RM per kWh */
  rate: number;
}

export interface Tenancy {
  contractId: string;
  contractCode: string;
  roomId: string;
  roomCode: string;
  tenantName: string;
  occupants: number;
  /** Which usage charges this tenant's contract includes (ticked on the agreement). */
  pays: Record<UtilityKind, boolean>;
  /** Exemptions covering this billing month, by kind. */
  exempt: Partial<Record<UtilityKind, { reason: string; until: string | null }>>;
}

/** BILL: charged to the tenant. EXEMPT / NOT_IN_CONTRACT: the company pays this share. */
export type LineStatus = "BILL" | "EXEMPT" | "NOT_IN_CONTRACT";

export interface Line {
  kind: UtilityKind;
  meterId: string;
  amount: number;
  status: LineStatus;
  /** This tenant's weight out of the meter's total; null for their own room's meter.
   * by: ROOM = one share per room, PEOPLE = by headcount, SAME_ROOM = two tenancies in one room
   * that month sharing its meter. */
  share: { weight: number; total: number; by: "ROOM" | "PEOPLE" | "SAME_ROOM" } | null;
}

export interface TenantBill {
  tenancy: Tenancy;
  lines: Line[];
  /** Sum of the BILL lines — what the tenant pays before any manual change. */
  total: number;
}

export interface MeterResult {
  meter: MeterUsage;
  /** usage × rate */
  amount: number;
  /** Total weight it was split by (rooms or people); 0 = nobody living there. */
  shareTotal: number;
  /** Nobody to bill — the company pays the whole meter (e.g. an empty room's aircon). */
  vacant: boolean;
}

export interface SplitResult {
  meters: MeterResult[];
  tenants: TenantBill[];
  /** All meters × rates */
  total: number;
  /** What tenants are billed */
  billed: number;
  /** total − billed: exempt shares, shares not in a contract, empty rooms, rounding */
  company: number;
}

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function splitUsage(meters: MeterUsage[], tenancies: Tenancy[], splitBy: SplitBy): SplitResult {
  const bills = new Map<string, TenantBill>(tenancies.map((t) => [t.contractId, { tenancy: t, lines: [], total: 0 }]));
  const meterResults: MeterResult[] = [];

  for (const m of meters) {
    const amount = round2(m.usage * m.rate);
    const group = m.roomId ? tenancies.filter((t) => t.roomId === m.roomId) : tenancies;
    // A room's own meter is shared equally only in the rare month two tenancies overlap in it;
    // the unit's electricity meter follows the chosen split; washer + dryer is per room.
    const byPeople = splitsByPeople(m.kind, m.roomId, splitBy);
    const weight = (t: Tenancy) => (byPeople ? Math.max(1, Math.floor(t.occupants || 1)) : 1);
    const shareTotal = group.reduce((s, t) => s + weight(t), 0);
    meterResults.push({ meter: m, amount, shareTotal, vacant: shareTotal === 0 });
    if (shareTotal === 0) continue;

    for (const t of group) {
      const w = weight(t);
      const status: LineStatus = t.exempt[m.kind] ? "EXEMPT" : !t.pays[m.kind] ? "NOT_IN_CONTRACT" : "BILL";
      bills.get(t.contractId)!.lines.push({
        kind: m.kind,
        meterId: m.meterId,
        amount: round2((amount * w) / shareTotal),
        status,
        share: m.roomId && group.length === 1 ? null : { weight: w, total: shareTotal, by: m.roomId ? "SAME_ROOM" : byPeople ? "PEOPLE" : "ROOM" },
      });
    }
  }

  const tenants = [...bills.values()];
  for (const b of tenants) b.total = round2(b.lines.filter((l) => l.status === "BILL").reduce((s, l) => s + l.amount, 0));
  const total = round2(meterResults.reduce((s, r) => s + r.amount, 0));
  const billed = round2(tenants.reduce((s, b) => s + b.total, 0));
  return { meters: meterResults, tenants, total, billed, company: round2(total - billed) };
}

/** Manual changes keyed `${contractId}:${kind}`: a number replaces that tenant's amount for the
 * kind (0 = don't bill it). */
export type Overrides = Record<string, number>;
export const overrideKey = (contractId: string, kind: UtilityKind) => `${contractId}:${kind}`;

/** Prepaid balance each tenancy still has, by kind — e.g. aircon top-up left on the smart meter
 * when the room moved to monthly billing. It comes off that kind's bills until it's used up. */
export type Credits = Record<string, Partial<Record<UtilityKind, number>>>;

export interface FinalBill {
  contractId: string;
  kind: UtilityKind;
  /** What the rules worked out (BILL lines only). */
  computed: number;
  /** What will actually be billed (after any manual change and prepaid balance). */
  amount: number;
  overridden: boolean;
  /** Taken off from the tenant's prepaid balance. */
  credit: number;
}

/** One bill per tenant per kind, after manual changes and prepaid balance. Kinds with nothing to
 * bill are left out; one fully paid from the balance stays in (amount 0) so it can be shown and
 * recorded, but gets no bill. */
export function finalBills(
  result: SplitResult,
  overrides: Overrides = {},
  credits: Credits = {}
): { bills: FinalBill[]; billed: number; credited: number; company: number } {
  const bills: FinalBill[] = [];
  for (const t of result.tenants) {
    for (const kind of UTILITY_KINDS) {
      const lines = t.lines.filter((l) => l.kind === kind);
      if (!lines.length) continue;
      const computed = round2(lines.filter((l) => l.status === "BILL").reduce((s, l) => s + l.amount, 0));
      const key = overrideKey(t.tenancy.contractId, kind);
      const overridden = key in overrides && Number.isFinite(overrides[key]);
      const due = overridden ? round2(Math.max(0, overrides[key])) : computed;
      const credit = round2(Math.min(due, Math.max(0, credits[t.tenancy.contractId]?.[kind] ?? 0)));
      const amount = round2(due - credit);
      if (amount > 0 || credit > 0) bills.push({ contractId: t.tenancy.contractId, kind, computed, amount, overridden, credit });
    }
  }
  const billed = round2(bills.reduce((s, b) => s + b.amount, 0));
  const credited = round2(bills.reduce((s, b) => s + b.credit, 0));
  return { bills, billed, credited, company: round2(result.total - billed - credited) };
}
