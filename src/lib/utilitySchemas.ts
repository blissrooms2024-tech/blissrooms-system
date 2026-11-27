import { z } from "zod";
import { UTILITY_KINDS } from "@/lib/utilitySplit";

/** Request bodies for the 抄表开单 API. */

const kind = z.enum(UTILITY_KINDS as [string, ...string[]]);
const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const meterSchema = z.object({
  kind,
  roomId: z.string().min(1).nullable(),
  label: z.string().trim().max(60).nullable().optional(),
  meterNo: z.string().trim().max(60).nullable().optional(),
  inputMode: z.enum(["READING", "USAGE"]),
  startReading: z.coerce.number().min(0).nullable().optional(),
});

export const meterPatchSchema = meterSchema.partial().omit({ kind: true });

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
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
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
