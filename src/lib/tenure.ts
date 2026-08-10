/** Bidirectional tenure <-> date-range math, ported from the original `autoTenure()`. */

export function monthsBetween(startISO: string, endISO: string): number {
  const d1 = new Date(startISO);
  const d2 = new Date(endISO);
  let m = (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
  if (d2.getDate() < d1.getDate()) m--; // partial month doesn't count
  return m;
}

export function endDateFromTenure(startISO: string, months: number): string {
  const d = new Date(startISO);
  d.setMonth(d.getMonth() + months);
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}
