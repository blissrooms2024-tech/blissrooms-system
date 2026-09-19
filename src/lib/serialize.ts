import { Decimal } from "@prisma/client/runtime/client";

/**
 * Recursively converts Prisma `Decimal` -> number and `Date` -> "yyyy-MM-dd" string,
 * mirroring the original Apps Script `cleanDates_()` helper so the frontend can keep
 * treating every date/money field as a plain JSON-safe value.
 */
export function serialize<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (value instanceof Decimal) return Number(value) as unknown as T;
  if (value instanceof Date) {
    // A handful of legacy-imported rows ended up with an unparseable date stored — don't let
    // one bad row 500 the whole list; surface it as "no value" the same way a blank cell would.
    if (isNaN(value.getTime())) return null as unknown as T;
    return value.toISOString().slice(0, 10) as unknown as T;
  }
  if (Array.isArray(value)) return value.map(serialize) as unknown as T;
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = serialize(v);
    }
    return out as T;
  }
  return value;
}
