/**
 * The parts of reading a claim's receipt that touch neither the network nor the database:
 * tidying what the model returned, working out which unit a receipt is for, and spotting the
 * same receipt claimed twice. Kept free of imports so it can be unit-tested on its own.
 */

/** What a receipt says, as read off its photos. */
export interface Reading {
  /** False when the photos aren't a receipt / bill, or its total can't be made out. */
  readable: boolean;
  /** Grand total actually paid, RM. */
  amount: number | null;
  /** YYYY-MM-DD. */
  date: string | null;
  /** Who was paid: shop, company or person. */
  merchant: string | null;
  receiptNo: string | null;
  /** What was bought or paid for, short, in the reader's language. */
  items: string | null;
  /** One of the hand-pickable expense categories. */
  category: string | null;
  /** Name for an OTHER expense, e.g. 灭虫费. */
  otherLabel: string | null;
  /** Utility / internet account numbers printed on a bill. */
  accountNumbers: string[];
  /** The address the receipt or bill is for (not the shop's own). */
  address: string | null;
  /** Something the person should double-check. */
  note: string | null;
}

const text = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null;
  const s = v.replace(/\s+/g, " ").trim();
  return s ? s.slice(0, max) : null;
};

const dayNo = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 86_400_000;

/** Letters and digits only, upper case: "TM-1234 " → "TM1234". */
export const normCode = (s: string) => s.normalize("NFKC").toUpperCase().replace(/[^0-9A-Z]/g, "");

/** For names in any script: lower case, letters and digits only. */
export const normName = (s: string) => s.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

/** Turn the model's JSON into a Reading: money to the sen, dates checked, text trimmed. */
export function cleanReading(raw: unknown, today: string, categories: readonly string[]): Reading {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const n = typeof r.amount === "number" ? r.amount : typeof r.amount === "string" ? Number(r.amount.replace(/[^0-9.]/g, "")) : NaN;
  const amount = Number.isFinite(n) && n > 0 && n < 1_000_000 ? Math.round(n * 100) / 100 : null;

  let date = typeof r.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.date.trim()) ? r.date.trim() : null;
  if (date) {
    const [y, m, d] = date.split("-").map(Number);
    const real = new Date(Date.UTC(y, m - 1, d));
    const exists = real.getUTCFullYear() === y && real.getUTCMonth() === m - 1 && real.getUTCDate() === d;
    // A receipt dated in the future is a misread (often day and month swapped); one more than
    // two years old almost certainly is too.
    if (!exists || dayNo(date) > dayNo(today) || dayNo(today) - dayNo(date) > 730) date = null;
  }

  const category = typeof r.category === "string" && categories.includes(r.category) ? r.category : null;
  const accounts = Array.isArray(r.account_numbers) ? r.account_numbers : [];
  const accountNumbers = [
    ...new Set(accounts.map((a) => (typeof a === "string" ? a.trim() : "")).filter((a) => normCode(a).length >= 6)),
  ].slice(0, 5);

  return {
    readable: r.readable !== false && amount !== null,
    amount,
    date,
    merchant: text(r.merchant, 80),
    receiptNo: text(r.receipt_no, 40),
    items: text(r.items, 200),
    category,
    otherLabel: category === "OTHER" ? text(r.other_label, 60) : null,
    accountNumbers,
    address: text(r.address, 200),
    note: text(r.note, 200),
  };
}

/** A unit as the claim form's picker and the matcher see it. */
export interface UnitRef {
  propertyCode: string;
  name: string;
  /** The condo / apartment it's in. */
  building: string | null;
  /** Unit number as written, e.g. B-12-03. */
  unitNo: string | null;
  accounts: { label: string; accountNo: string }[];
}

export interface UnitMatch {
  /** The unit, when the receipt pins it down. */
  propertyCode: string | null;
  /** The condo, when at least that much is known. */
  building: string | null;
  via: "account" | "address" | null;
  /** What gave it away, e.g. "TNB 220011223344". */
  detail: string | null;
}

const NO_MATCH: UnitMatch = { propertyCode: null, building: null, via: null, detail: null };

/** The picker's first step: a unit's condo, or the unit itself when it isn't in one. */
export const groupOf = (u: Pick<UnitRef, "building" | "name">) => u.building ?? u.name;

function accountsMatch(a: string, b: string) {
  const x = normCode(a);
  const y = normCode(b);
  if (x.length < 6 || y.length < 6) return false;
  if (x === y) return true;
  // Bills sometimes print a check digit or prefix around the same account number.
  return Math.min(x.length, y.length) >= 8 && (x.includes(y) || y.includes(x));
}

/** "B-12-03" → a pattern that also finds "B-12-3", "B 12 03", "B/12/03" and "B12-03". */
export function unitNoPattern(unitNo: string): RegExp | null {
  const groups = unitNo.normalize("NFKC").toUpperCase().match(/[A-Z]+|\d+/g);
  if (!groups || groups.length < 2 || !groups.some((g) => /^\d+$/.test(g))) return null;
  const body = groups.map((g) => (/^\d+$/.test(g) ? `0*${Number(g)}` : g)).join("[\\s\\-/.]*");
  return new RegExp(`(?<![A-Z0-9])${body}(?![0-9])`, "i");
}

/**
 * Which unit a receipt is for. A utility account number on a bill is the surest sign; otherwise
 * the address printed on it, which has to name the condo (a unit number alone could just as
 * well be the shop's own address). Returns only the condo when the unit can't be told apart.
 */
export function matchUnit(r: Pick<Reading, "accountNumbers" | "address">, units: UnitRef[]): UnitMatch {
  const byAccount = new Map<string, string>();
  for (const u of units)
    for (const acc of u.accounts)
      for (const no of r.accountNumbers) if (accountsMatch(no, acc.accountNo)) byAccount.set(u.propertyCode, `${acc.label} ${acc.accountNo}`);
  if (byAccount.size === 1) {
    const [[code, detail]] = [...byAccount];
    const u = units.find((x) => x.propertyCode === code)!;
    return { propertyCode: code, building: groupOf(u), via: "account", detail };
  }

  const addr = r.address;
  if (!addr) return NO_MATCH;
  const addrName = normName(addr);
  const inCondo = units.filter((u) =>
    [u.building, u.name].some((n) => {
      const k = n ? normName(n) : "";
      return k.length >= 4 && addrName.includes(k);
    })
  );
  if (!inCondo.length) return NO_MATCH;

  const hits = inCondo.filter((u) => u.unitNo && unitNoPattern(u.unitNo)?.test(addr));
  if (hits.length === 1) return { propertyCode: hits[0].propertyCode, building: groupOf(hits[0]), via: "address", detail: addr };

  const condos = [...new Set(inCondo.map(groupOf))];
  if (condos.length !== 1) return NO_MATCH;
  const all = units.filter((u) => groupOf(u) === condos[0]);
  // The only unit we have in that condo: nothing left to choose.
  if (all.length === 1) return { propertyCode: all[0].propertyCode, building: condos[0], via: "address", detail: addr };
  return { propertyCode: null, building: condos[0], via: "address", detail: addr };
}

/** The bits of a receipt that tell one apart from another. */
export interface ReceiptKey {
  merchant: string | null;
  receiptNo: string | null;
  amount: number | null;
  date: string | null;
}

const FILLER = new Set([
  "sdn", "bhd", "berhad", "enterprise", "ent", "trading", "plt", "m", "malaysia", "store", "shop",
  "the", "co", "company", "services", "service", "station", "and",
]);

/** "MR. DIY (M) SDN BHD" and "Mr DIY Trading" are the same shop. */
export function sameMerchant(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  const x = normName(a);
  const y = normName(b);
  if (x.length >= 3 && y.length >= 3 && (x === y || x.includes(y) || y.includes(x))) return true;
  const key = (s: string) =>
    s.normalize("NFKC").toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w && !FILLER.has(w)).slice(0, 2).join("");
  const kx = key(a);
  return kx.length >= 3 && kx === key(b);
}

/**
 * Two claims for the same receipt: the same receipt number (from the same shop, when both
 * name one), or the same shop, day and amount.
 */
export function sameReceipt(a: ReceiptKey, b: ReceiptKey): boolean {
  const sameMoney = a.amount != null && b.amount != null && Math.abs(a.amount - b.amount) < 0.005;
  const na = a.receiptNo ? normCode(a.receiptNo) : "";
  if (na.length >= 3 && b.receiptNo && na === normCode(b.receiptNo)) {
    // Short running numbers repeat from shop to shop.
    if (a.merchant && b.merchant) return sameMerchant(a.merchant, b.merchant);
    return na.length >= 6 || sameMoney;
  }
  return sameMoney && !!a.date && a.date === b.date && sameMerchant(a.merchant, b.merchant);
}
