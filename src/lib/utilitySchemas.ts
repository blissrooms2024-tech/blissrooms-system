import { z } from "zod";
import { UTILITY_KINDS } from "@/lib/utilitySplit";

/** Request bodies for the 抄表开单 API. */

const kind = z.enum(UTILITY_KINDS as [string, ...string[]]);
const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

export const meterSchema = z.object({
  kind,
  roomId: z.string().min(1).nullable(),
  label: z.string().trim().max(60).nullable().optional(),
  meterNo: z.string().trim().max(60).nullable().optional(),
  inputMode: z.enum(["READING", "USAGE"]),
  startReading: z.coerce.number().min(0).nullable().optional(),
  /** First month to bill (YYYY-MM); defaults to this month. */
  startPeriod: month.optional(),
  /** Aircon only: what's left on the smart meter for the room's tenant, taken off their bills. */
  credit: z.coerce.number().min(0).max(10000).optional(),
});

export const meterPatchSchema = meterSchema.partial().omit({ kind: true, credit: true });

/** Set a tenancy's prepaid balance for a usage charge to this amount. */
export const creditSchema = z.object({
  contractCode: z.string().min(1),
  kind,
  balance: z.coerce.number().min(0).max(10000),
});

export const exemptionSchema = z.object({
  contractCode: z.string().min(1),
  kinds: z.array(kind).min(1),
  startDate: isoDay,
  endDate: isoDay.nullable(),
  reason: z.string().trim().min(2).max(200),
});

export const exemptionPatchSchema = z.object({
  endDate: isoDay.nullable(),
  reason: z.string().trim().min(2).max(200),
});

const num = z.number().finite().min(0);

export const runSchema = z.object({
  period: month,
  splitBy: z.enum(["ROOM", "PEOPLE"]),
  dueDate: isoDay,
  inputs: z.array(
    z.object({
      meterId: z.string().min(1),
      previous: num.nullable().optional(),
      reading: num.nullable().optional(),
      usage: num.nullable().optional(),
      photoUrl: z.string().max(2000).nullable().optional(),
    })
  ),
  overrides: z.record(z.string(), num).default({}),
  skip: z.array(z.string()).default([]),
});
