import { z } from "zod";

// People fill spreadsheets with "-", "–", "—", "N/A" etc. to mean "no value" — treat those
// the same as a genuinely blank cell instead of failing to coerce them into a number.
const BLANK_MARKERS = new Set(["-", "–", "—", "n/a", "na", "nil", "none", "x"]);
function blankAware(v: unknown) {
  if (typeof v === "string" && BLANK_MARKERS.has(v.trim().toLowerCase())) return "";
  return v;
}

const optDate = z.preprocess(
  blankAware,
  z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? new Date(v) : undefined))
    .refine((d) => d === undefined || !isNaN(d.getTime()), { message: "日期格式不对，要用 YYYY-MM-DD" })
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
