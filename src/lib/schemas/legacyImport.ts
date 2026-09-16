import { z } from "zod";

// People fill spreadsheets with "-", "–", "—", "N/A" etc. to mean "no value" — treat those
// the same as a genuinely blank cell instead of failing to coerce them into a number. "RENEWAL"
// shows up in the Move-in Date column for tenants who are just renewing (no real new move-in
// date on record) — same idea, treat it as blank rather than an invalid date.
const BLANK_MARKERS = new Set(["-", "–", "—", "n/a", "na", "nil", "none", "x", "renewal"]);
function blankAware(v: unknown) {
  if (typeof v === "string" && BLANK_MARKERS.has(v.trim().toLowerCase())) return "";
  return v;
}

// Parses a date string as day-first (matching this system's DD/MM/YYYY convention) instead of
// handing it to `new Date()` directly — for a slash/dash-separated numeric date like "1/8/2026",
// native parsing assumes MM/DD/YYYY and would silently read it as 8 Jan instead of 1 Aug, only
// erroring when the day happens to exceed 12. Falls back to native parsing for forms native
// Date already parses unambiguously, like "2-Aug-2026" (a named month can't be misread as a day).
// Returns an Invalid Date (never throws/undefined) on failure so the caller can tell "bad
// date string" apart from "field was blank" the same way `new Date(v)` used to.
function parseLegacyDate(v: string): Date {
  const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(v);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const year = Number(dmy[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return new Date(NaN);
    return new Date(Date.UTC(year, month - 1, day));
  }
  const ymd = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(v);
  if (ymd) {
    return new Date(Date.UTC(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3])));
  }
  return new Date(v);
}

const optDate = z.preprocess(
  blankAware,
  z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? parseLegacyDate(v) : undefined))
    .refine((d) => d === undefined || !isNaN(d.getTime()), {
      message: "日期格式不对，要用 DD/MM/YYYY 或 YYYY-MM-DD",
    })
);

const optNumber = z.preprocess(blankAware, z.coerce.number().min(0).optional().default(0));

const ynFlag = z
  .string()
  .trim()
  .toUpperCase()
  .optional()
  .transform((v) => v === "Y");

export const legacyImportRowSchema = z.object({
  roomCode: z.string().trim().min(1, "房间 Room Code 一定要填"),
  tenantName: z.string().trim().min(1, "租客姓名一定要填"),
  tenantIc: z.string().trim().min(1, "租客 IC 一定要填"),
  email: z.string().trim().toLowerCase().email("Email 格式不对"),
  phone: z.string().trim().optional().default(""),
  moveInDate: optDate,
  commencementDate: optDate,
  expiredDate: optDate,
  tenureMonths: z.preprocess(blankAware, z.coerce.number().optional()),
  roomRental: z.preprocess(blankAware, z.coerce.number().min(0, "房租一定要填")),
  carparkRental: optNumber,
  securityDeposit: optNumber,
  utilitiesDeposit: optNumber,
  accessCardDeposit: optNumber,
  adminFee: optNumber,
  nationality: z.string().trim().optional().default(""),
  occupation: z.string().trim().optional().default(""),
  company: z.string().trim().optional().default(""),
  carPlate: z.string().trim().optional().default(""),
  emergencyName: z.string().trim().optional().default(""),
  emergencyContact: z.string().trim().optional().default(""),
  emergencyRelationship: z.string().trim().optional().default(""),
  utilDryer: ynFlag,
  utilAircond: ynFlag,
  utilElectric: ynFlag,
  agentCode: z.string().trim().optional().default(""),
  remarks: z.string().trim().optional().default(""),
  carparkRoomCode: z.string().trim().optional().default(""),
});

export type LegacyImportRow = z.infer<typeof legacyImportRowSchema>;

// Column order must match the Excel template exactly (row 1 headers, data from row 2).
export const LEGACY_IMPORT_COLUMNS: (keyof LegacyImportRow)[] = [
  "roomCode",
  "tenantName",
  "tenantIc",
  "email",
  "phone",
  "moveInDate",
  "commencementDate",
  "expiredDate",
  "tenureMonths",
  "roomRental",
  "carparkRental",
  "securityDeposit",
  "utilitiesDeposit",
  "accessCardDeposit",
  "adminFee",
  "nationality",
  "occupation",
  "company",
  "carPlate",
  "emergencyName",
  "emergencyContact",
  "emergencyRelationship",
  "utilDryer",
  "utilAircond",
  "utilElectric",
  "agentCode",
  "remarks",
  "carparkRoomCode",
];
