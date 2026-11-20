const BREAKDOWN_ITEMS = ["DEPOSIT", "UTILITIES", "ADMIN_FEE", "ACCESS_CARD", "CARPARK", "RENTAL"] as const;
const CARPARK_ONLY_ITEMS = ["ACCESS_CARD", "CARPARK"] as const;
export type BreakdownItemType = (typeof BREAKDOWN_ITEMS)[number];

interface ContractFieldsForBreakdown {
  securityDeposit: unknown;
  utilitiesDeposit: unknown;
  adminFee: unknown;
  accessCardDeposit: unknown;
  carparkRental: unknown;
  roomRental: unknown;
}
interface PaymentFieldsForBreakdown {
  type: string;
  amountDue: unknown;
  amountPaid: unknown;
  status: string;
}

export interface BreakdownRow {
  item: BreakdownItemType;
  due: number;
  paid: number;
  outstanding: number;
}

export interface BillBreakdown {
  items: readonly BreakdownItemType[];
  breakdown: BreakdownRow[];
  totalDue: number;
  totalPaid: number;
  totalOutstanding: number;
}

/**
 * The single source of truth for "how much is owed, per move-in-package item, right now" on a
 * contract. Every place that shows or validates a contract's 总款/已收/还欠 — the Payments
 * breakdown, the Contracts list, the Contract detail page, the lump-sum collection form, the
 * user-detail drill-down — must go through this. They each used to keep their own copy of this
 * math and had quietly drifted apart (one still used the static move-in-time
 * `Contract.totalOutstanding` snapshot, another recomputed "due" from the contract's reference
 * rates alone with no regard for what had actually been billed), so the same contract could show
 * three or four different "还欠" figures on three or four different pages.
 *
 * due[type] is whichever is larger of the contract's own reference rate and everything ever
 * actually billed for that type — so a recurring type (RENTAL/CARPARK) grows as more months get
 * billed, while a type that's never been separately billed still shows its sensible move-in
 * default. Because "due" already includes every bill ever issued for that type (PENDING,
 * REJECTED or Paid), outstanding is simply due minus paid — no separate "this type already has
 * an open bill, so skip it here and add its raw amount there instead" bookkeeping is needed (an
 * earlier version of this code tried exactly that, on the theory that otherwise an open bill's
 * amount would be double-counted — but due already contains every bill's amount once, so the
 * extra bookkeeping was itself the thing producing a second, inconsistent number).
 */
export function computeBillBreakdown(
  contract: ContractFieldsForBreakdown,
  payments: PaymentFieldsForBreakdown[],
  isCarpark: boolean
): BillBreakdown {
  const billedTotalByType: Record<string, number> = {};
  for (const p of payments) {
    billedTotalByType[p.type] = (billedTotalByType[p.type] || 0) + Number(p.amountDue);
  }
  const due: Record<BreakdownItemType, number> = {
    DEPOSIT: Math.max(Number(contract.securityDeposit), billedTotalByType.DEPOSIT || 0),
    UTILITIES: Math.max(Number(contract.utilitiesDeposit), billedTotalByType.UTILITIES || 0),
    ADMIN_FEE: Math.max(Number(contract.adminFee), billedTotalByType.ADMIN_FEE || 0),
    ACCESS_CARD: Math.max(Number(contract.accessCardDeposit), billedTotalByType.ACCESS_CARD || 0),
    CARPARK: Math.max(Number(contract.carparkRental), billedTotalByType.CARPARK || 0),
    RENTAL: Math.max(Number(contract.roomRental), billedTotalByType.RENTAL || 0),
  };
  const paidByType: Record<string, number> = {};
  for (const p of payments) {
    if (p.status !== "Paid") continue;
    paidByType[p.type] = (paidByType[p.type] || 0) + Number(p.amountPaid);
  }

  const items = isCarpark ? CARPARK_ONLY_ITEMS : BREAKDOWN_ITEMS;
  const breakdown: BreakdownRow[] = items.map((item) => {
    const dd = due[item] || 0;
    const pd = paidByType[item] || 0;
    return { item, due: dd, paid: pd, outstanding: Math.max(dd - pd, 0) };
  });

  const totalDue = breakdown.reduce((s, b) => s + b.due, 0);
  const totalPaid = breakdown.reduce((s, b) => s + b.paid, 0);
  const totalOutstanding = breakdown.reduce((s, b) => s + b.outstanding, 0);

  return { items, breakdown, totalDue, totalPaid, totalOutstanding };
}
