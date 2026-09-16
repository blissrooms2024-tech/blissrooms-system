export function fmtMoney(v: number | null | undefined): string {
  if (v === null || v === undefined) return "-";
  return `RM${Number(v).toLocaleString()}`;
}

// System-wide date display convention: 日/月/年 (DD/MM/YYYY). `v` is an ISO
// string (from the DB / API); string-sliced instead of parsed into a Date to
// avoid any timezone shift changing which calendar day gets shown.
export function fmtDate(v: string | null | undefined): string {
  if (!v) return "-";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  if (!m) return v.slice(0, 10);
  const [, yyyy, mm, dd] = m;
  return `${dd}/${mm}/${yyyy}`;
}
