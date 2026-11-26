/**
 * Quick rental quotation — pure calculation + WhatsApp text, shared by the browser and tests.
 *
 * Follows the same rules as contracts in this system:
 *  - Rent is billed per calendar month; the advance rental covers the first full month (from
 *    the tenancy start, normally the 1st).
 *  - Moving in before the tenancy start = "Pro-rata Rental (Early Move-in)": each early day is
 *    charged at monthly rent ÷ days in that calendar month.
 *  - A contract's total = advance rental (room + carpark) + deposits + access card + admin fee
 *    + pro-rata, all collected before key handover.
 */

export const QUOTE_DEFAULTS = {
  securityMonths: 2,
  utilitiesMonths: 0.5,
  advanceMonths: 1,
  accessCardSets: 1,
  accessCardPerSet: 100,
  adminFee: 200,
  tenureMonths: 12,
  /** Security deposit is worked out on room + carpark rent (untick to use room rent only). */
  depositIncludesCarpark: true,
} as const;

export interface QuoteInput {
  roomCode: string;
  propertyName: string;
  roomRent: number;
  carparkRent: number;
  carparkLabel: string | null;
  depositIncludesCarpark: boolean;
  securityMonths: number;
  utilitiesMonths: number;
  advanceMonths: number;
  accessCardSets: number;
  accessCardPerSet: number;
  adminFee: number;
  /** YYYY-MM-DD */
  moveInDate: string;
  /** YYYY-MM-DD — tenancy start; days before it (from move-in) are pro-rata. */
  commencementDate: string;
  chargeProrata: boolean;
  tenureMonths: number;
  /** Optional YYYY-MM-DD "please pay by". */
  payBy: string | null;
  /** Optional fixed amounts that replace the calculated ones. */
  overrides?: { security?: number | null; utilities?: number | null; prorata?: number | null };
}

export type LineKey = "security" | "utilities" | "advance" | "prorata" | "accessCard" | "adminFee";

export interface QuoteLine {
  key: LineKey;
  amount: number;
  refundable: boolean;
  /** Numbers the text builder needs to describe the line. */
  meta: Record<string, string | number>;
}

export interface QuoteResult {
  ok: boolean;
  error?: string;
  monthlyRent: number;
  lines: QuoteLine[];
  total: number;
  refundable: number;
  prorataDays: number;
  prorataFrom: string | null;
  prorataTo: string | null;
  advanceFrom: string;
  advanceTo: string;
  tenancyEnd: string;
}

const DAY = 24 * 3600 * 1000;
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function parseDay(s: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(t);
  return d.getUTCDate() === Number(m[3]) ? t : null;
}
export const isoDay = (t: number) => new Date(t).toISOString().slice(0, 10);
const daysInMonthOf = (t: number) => {
  const d = new Date(t);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
};

/** Same day-of-month N months later (clamped to month end), as YYYY-MM-DD. */
export function addMonthsDay(day: string, n: number): string {
  const t = parseDay(day)!;
  const d = new Date(t);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + n;
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return isoDay(Date.UTC(y, m, Math.min(d.getUTCDate(), last)));
}

/** Tenancy start for a move-in date: the 1st of next month, unless moving in on the 1st. */
export function defaultCommencement(moveIn: string): string {
  const t = parseDay(moveIn);
  if (t === null) return moveIn;
  const d = new Date(t);
  if (d.getUTCDate() === 1) return moveIn;
  return isoDay(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
}

export function computeQuote(q: QuoteInput): QuoteResult {
  const moveIn = parseDay(q.moveInDate);
  const start = parseDay(q.commencementDate);
  const base: QuoteResult = {
    ok: false,
    monthlyRent: 0,
    lines: [],
    total: 0,
    refundable: 0,
    prorataDays: 0,
    prorataFrom: null,
    prorataTo: null,
    advanceFrom: q.commencementDate,
    advanceTo: q.commencementDate,
    tenancyEnd: q.commencementDate,
  };
  const nums = [q.roomRent, q.carparkRent, q.securityMonths, q.utilitiesMonths, q.advanceMonths, q.accessCardSets, q.accessCardPerSet, q.adminFee, q.tenureMonths];
  if (nums.some((n) => !Number.isFinite(n) || n < 0)) return { ...base, error: "INVALID_NUMBER" };
  if (!(q.roomRent > 0)) return { ...base, error: "NO_RENT" };
  if (moveIn === null || start === null) return { ...base, error: "INVALID_DATE" };
  if (start < moveIn) return { ...base, error: "START_BEFORE_MOVE_IN" };
  if ((start - moveIn) / DAY > 92) return { ...base, error: "PRORATA_TOO_LONG" };

  const monthlyRent = round2(q.roomRent + q.carparkRent);
  const depositBase = q.depositIncludesCarpark ? monthlyRent : q.roomRent;

  // Pro-rata: every day from move-in up to (not including) the tenancy start.
  let prorata = 0;
  let days = 0;
  if (q.chargeProrata) {
    for (let t = moveIn; t < start; t += DAY) {
      prorata += monthlyRent / daysInMonthOf(t);
      days++;
    }
  }
  prorata = round2(prorata);

  const pick = (override: number | null | undefined, calc: number) =>
    override !== null && override !== undefined && Number.isFinite(override) && override >= 0 ? round2(override) : round2(calc);

  const security = pick(q.overrides?.security, q.securityMonths * depositBase);
  const utilities = pick(q.overrides?.utilities, q.utilitiesMonths * q.roomRent);
  const advance = round2(q.advanceMonths * monthlyRent);
  const accessCard = round2(q.accessCardSets * q.accessCardPerSet);
  const prorataAmt = days > 0 ? pick(q.overrides?.prorata, prorata) : 0;

  const advanceTo = q.advanceMonths > 0 ? isoDay(parseDay(addMonthsDay(q.commencementDate, Math.ceil(q.advanceMonths)))! - DAY) : q.commencementDate;
  const tenancyEnd = q.tenureMonths > 0 ? isoDay(parseDay(addMonthsDay(q.commencementDate, q.tenureMonths))! - DAY) : q.commencementDate;

  const lines: QuoteLine[] = [];
  if (security > 0) lines.push({ key: "security", amount: security, refundable: true, meta: { months: q.securityMonths, custom: q.overrides?.security != null ? 1 : 0 } });
  if (utilities > 0) lines.push({ key: "utilities", amount: utilities, refundable: true, meta: { months: q.utilitiesMonths, custom: q.overrides?.utilities != null ? 1 : 0 } });
  if (advance > 0) lines.push({ key: "advance", amount: advance, refundable: false, meta: { months: q.advanceMonths, from: q.commencementDate, to: advanceTo } });
  if (prorataAmt > 0)
    lines.push({ key: "prorata", amount: prorataAmt, refundable: false, meta: { days, from: q.moveInDate, to: isoDay(start - DAY) } });
  if (accessCard > 0) lines.push({ key: "accessCard", amount: accessCard, refundable: true, meta: { sets: q.accessCardSets, perSet: q.accessCardPerSet } });
  if (q.adminFee > 0) lines.push({ key: "adminFee", amount: round2(q.adminFee), refundable: false, meta: {} });

  const total = round2(lines.reduce((s, l) => s + l.amount, 0));
  const refundable = round2(lines.filter((l) => l.refundable).reduce((s, l) => s + l.amount, 0));
  return {
    ok: true,
    monthlyRent,
    lines,
    total,
    refundable,
    prorataDays: days,
    prorataFrom: days > 0 ? q.moveInDate : null,
    prorataTo: days > 0 ? isoDay(start - DAY) : null,
    advanceFrom: q.commencementDate,
    advanceTo,
    tenancyEnd,
  };
}

// ---------------------------------------------------------------- WhatsApp text

const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const money = (n: number) => `RM${n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const num = (n: number) => String(Number(n.toFixed(2)));

function dateText(day: string, lang: "en" | "zh") {
  const [y, m, d] = day.split("-").map(Number);
  return lang === "en" ? `${d} ${MONTHS_EN[m - 1]} ${y}` : `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}
function rangeText(from: string, to: string, lang: "en" | "zh") {
  return from === to ? dateText(from, lang) : `${dateText(from, lang)} – ${dateText(to, lang)}`;
}

export function lineLabel(l: QuoteLine, lang: "en" | "zh"): string {
  const m = l.meta;
  const en = lang === "en";
  switch (l.key) {
    case "security":
      return en
        ? `Security Deposit${m.custom ? "" : ` (${num(Number(m.months))} month${Number(m.months) === 1 ? "" : "s"})`}, refundable`
        : `押金${m.custom ? "" : `（${num(Number(m.months))} 个月）`}，可退还`;
    case "utilities":
      return en
        ? `Utilities Deposit${m.custom ? "" : ` (${num(Number(m.months))} month)`}, refundable`
        : `水电押金${m.custom ? "" : `（${num(Number(m.months))} 个月）`}，可退还`;
    case "advance":
      return en
        ? `Advance Rental (${num(Number(m.months))} month: ${rangeText(String(m.from), String(m.to), "en")})`
        : `预付租金（${num(Number(m.months))} 个月：${rangeText(String(m.from), String(m.to), "zh")}）`;
    case "prorata":
      return en
        ? `Pro-rata Rental, early move-in (${rangeText(String(m.from), String(m.to), "en")}, ${m.days} day${m.days === 1 ? "" : "s"})`
        : `Pro-rata 租金，提早入住（${rangeText(String(m.from), String(m.to), "zh")}，${m.days} 天）`;
    case "accessCard":
      return en
        ? `Access Card (${m.sets} set${m.sets === 1 ? "" : "s"} × ${money(Number(m.perSet))}), refundable`
        : `门卡（${m.sets} 套 × ${money(Number(m.perSet))}），可退还`;
    case "adminFee":
      return en ? "Admin Fee, non-refundable" : "Admin Fee，不可退还";
  }
}

export function buildQuoteText(
  q: QuoteInput,
  r: QuoteResult,
  opts: { lang: "en" | "zh"; companyName: string; today: string; bank?: { name: string; accNo: string; holder: string } | null }
): string {
  const en = opts.lang === "en";
  const c = en ? ": " : "："; // colon style per language
  const L: string[] = [];
  L.push(en ? `*${opts.companyName} — Rental Quotation*` : `*${opts.companyName} — 租房报价*`);
  L.push("");
  L.push(`${en ? "Room" : "房间"}${c}*${q.roomCode}*${q.propertyName ? ` (${q.propertyName})` : ""}`);
  L.push(`${en ? "Move-in" : "入住日期"}${c}${dateText(q.moveInDate, opts.lang)}`);
  if (q.tenureMonths > 0) {
    L.push(
      en
        ? `Tenancy: ${num(q.tenureMonths)} months, ${rangeText(q.commencementDate, r.tenancyEnd, "en")}`
        : `租期：${num(q.tenureMonths)} 个月（${rangeText(q.commencementDate, r.tenancyEnd, "zh")}）`
    );
  }
  if (q.carparkRent > 0) {
    L.push(
      en
        ? `Monthly rental: ${money(q.roomRent)} (room) + ${money(q.carparkRent)} (carpark${q.carparkLabel ? ` ${q.carparkLabel}` : ""}) = *${money(r.monthlyRent)}*`
        : `每月租金：${money(q.roomRent)}（房间）+ ${money(q.carparkRent)}（车位${q.carparkLabel ? ` ${q.carparkLabel}` : ""}）= *${money(r.monthlyRent)}*`
    );
  } else {
    L.push(`${en ? "Monthly rental" : "每月租金"}${c}*${money(r.monthlyRent)}*`);
  }
  L.push("");
  L.push(en ? "*To pay before key handover:*" : "*交钥匙前需付清：*");
  for (const l of r.lines) L.push(`• ${lineLabel(l, opts.lang)}${c}${money(l.amount)}`);
  L.push("━━━━━━━━━━");
  L.push(`*${en ? "TOTAL" : "总额"}${c}${money(r.total)}*`);
  if (r.refundable > 0) L.push(en ? `(Refundable deposits: ${money(r.refundable)})` : `（其中可退还押金：${money(r.refundable)}）`);
  if (q.payBy) L.push(en ? `Please pay by: *${dateText(q.payBy, "en")}*` : `请在 *${dateText(q.payBy, "zh")}* 前付清`);
  if (opts.bank) {
    L.push("");
    L.push(en ? `Payment to: ${opts.bank.name} ${opts.bank.accNo} (${opts.bank.holder})` : `付款户口：${opts.bank.name} ${opts.bank.accNo}（${opts.bank.holder}）`);
  }
  L.push("");
  L.push(en ? `_Quoted on ${dateText(opts.today, "en")}. Subject to room availability._` : `_报价日期 ${dateText(opts.today, "zh")}，以房间实际空置为准。_`);
  return L.join("\n");
}

/** Malaysian phone → wa.me number: "012-345 6789" → "60123456789". Returns null if unusable. */
export function waNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let d = phone.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("0")) d = "6" + d;
  if (d.length < 10 || d.length > 15) return null;
  return d;
}
