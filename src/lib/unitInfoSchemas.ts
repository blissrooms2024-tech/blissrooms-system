import { z } from "zod";
import { CARD_HOLDERS, CARD_STATUSES, CARD_TYPES, PAY_TO, UTILITY_TYPES } from "@/lib/unitInfo";

const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));
const optMoney = z
  .union([z.string(), z.number(), z.null()])
  .optional()
  .transform((v, ctx) => {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0 || n > 1_000_000) {
      ctx.addIssue({ code: "custom", message: "金额不对" });
      return z.NEVER;
    }
    return Math.round(n * 100) / 100;
  });
const optDate = z
  .union([z.string(), z.null()])
  .optional()
  .transform((v, ctx) => {
    if (!v) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      ctx.addIssue({ code: "custom", message: "日期格式不对" });
      return z.NEVER;
    }
    return new Date(`${v}T00:00:00.000Z`);
  });

export const cardSchema = z.object({
  cardType: z.enum(CARD_TYPES),
  serialNo: optText(80),
  holder: z.enum(CARD_HOLDERS).default("OFFICE"),
  roomCode: optText(40),
  status: z.enum(CARD_STATUSES).default("SPARE"),
  deposit: optMoney,
  notes: optText(300),
});

export const utilitySchema = z.object({
  utilityType: z.enum(UTILITY_TYPES),
  provider: optText(80),
  accountNo: optText(80),
  accountHolder: optText(120),
  payTo: z.enum(PAY_TO).default("PROVIDER"),
  fixedAmount: optMoney,
  dueDay: z
    .union([z.string(), z.number(), z.null()])
    .optional()
    .transform((v, ctx) => {
      if (v === null || v === undefined || v === "") return null;
      const n = Number(v);
      if (!Number.isInteger(n) || n < 1 || n > 31) {
        ctx.addIssue({ code: "custom", message: "到期日要填 1–31" });
        return z.NEVER;
      }
      return n;
    }),
  autoDebit: z.boolean().default(false),
  meterNo: optText(80),
  contractEnd: optDate,
  notes: optText(300),
  /** Latest billing month marked paid (YYYY-MM) — editable in case someone marked it by mistake. */
  lastPaidPeriod: z
    .union([z.string(), z.null()])
    .optional()
    .transform((v, ctx) => {
      if (!v) return null;
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(v)) {
        ctx.addIssue({ code: "custom", message: "已付月份格式不对" });
        return z.NEVER;
      }
      return v;
    }),
});

export function firstIssue(err: z.ZodError): string {
  const i = err.issues[0];
  return i?.message && i.code === "custom" ? i.message : "资料格式不对";
}
