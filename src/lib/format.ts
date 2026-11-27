// Uploaded proof-of-payment / attachment URLs are either an image (shown inline with a
// thumbnail + zoom) or a PDF (browsers render these natively, so it's just opened in a new
// tab instead) — `uploadDataUrl` always names the stored blob with the real extension, so
// checking the URL for ".pdf" reliably tells the two apart without a network round-trip.
export function isPdfUrl(v: string | null | undefined): boolean {
  if (!v) return false;
  const s = v.toLowerCase();
  // ".pdf" covers an already-uploaded storage URL; "data:application/pdf" covers a local
  // preview still held as a base64 data URL before it's been uploaded at all.
  return s.includes(".pdf") || s.startsWith("data:application/pdf");
}

export function fmtMoney(v: number | null | undefined): string {
  if (v === null || v === undefined) return "-";
  return `RM${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

// For a genuine moment-in-time field (when a slip was actually uploaded, when Admin actually
// reviewed it) rather than a plain calendar date (dueDate, periodMonth) — unlike fmtDate, this
// parses into a real Date and reads the clock fields back from it, so the time-of-day shown is
// converted into whatever timezone the viewer's own browser is in (correct for everyone, since
// a timestamp has one real instant but the local wall-clock reading of it differs by viewer).
export function fmtDateTime(v: string | null | undefined): string {
  if (!v) return "-";
  const d = new Date(v);
  if (isNaN(d.getTime())) return fmtDate(v);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()} ${hh}:${min}`;
}
