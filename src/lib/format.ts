export function fmtMoney(v: number | null | undefined): string {
  if (v === null || v === undefined) return "-";
  return `RM${Number(v).toLocaleString()}`;
}

export function fmtDate(v: string | null | undefined): string {
  if (!v) return "________";
  return v.slice(0, 10);
}
