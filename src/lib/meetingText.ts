/** Words and times for 会议记录 — pure, so the page and the tests share them. All times are shown
 * in Malaysia time (UTC+8) whatever the device's time zone. */

const WEEKDAY_ZH = ["日", "一", "二", "三", "四", "五", "六"];
const MY_OFFSET = 8 * 3600_000;

function my(isoTime: string) {
  const d = new Date(Date.parse(isoTime) + MY_OFFSET);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`,
    ymd: d.toISOString().slice(0, 10),
    weekday: WEEKDAY_ZH[d.getUTCDay()],
    time: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`,
  };
}

/** "27/11/2026（五）14:00–15:30" */
export function whenText(startsAt: string, endsAt: string | null) {
  const s = my(startsAt);
  if (!endsAt) return `${s.date}（${s.weekday}）${s.time}`;
  const e = my(endsAt);
  return e.ymd === s.ymd ? `${s.date}（${s.weekday}）${s.time}–${e.time}` : `${s.date}（${s.weekday}）${s.time} – ${e.date} ${e.time}`;
}

/** "14:00–15:30" (or "14:00") — the time part only. */
export function timeText(startsAt: string, endsAt: string | null) {
  const s = my(startsAt);
  return endsAt ? `${s.time}–${my(endsAt).time}` : s.time;
}

/** Date and time inputs (Malaysia time) for an ISO moment. */
export function toInputs(isoTime: string) {
  const p = my(isoTime);
  return { date: p.ymd, time: p.time };
}

/** ISO moment from a Malaysia date (YYYY-MM-DD) and time (HH:MM). */
export function fromInputs(date: string, time: string) {
  return new Date(`${date}T${time || "00:00"}:00+08:00`).toISOString();
}

/** "12/12" style due date, or "" */
export function dueText(due: string | null) {
  if (!due) return "";
  return `${due.slice(8, 10)}/${due.slice(5, 7)}`;
}

interface IssueLike {
  title: string;
  owner: string | null;
  followUp: string | null;
  dueDate: string | null;
  doneNote?: string | null;
}

function issueLine(i: IssueLike) {
  const who = [i.owner ? `处理：${i.owner}` : "", i.followUp ? `跟进：${i.followUp}` : "", i.dueDate ? `${dueText(i.dueDate)} 前` : ""].filter(Boolean).join("，");
  return `${i.title}${who ? `（${who}）` : ""}`;
}

/** The whole record as a message for WhatsApp: when, where, who, everyone's notes, issues. */
export function minutesText(m: {
  title: string;
  startsAt: string;
  endsAt: string | null;
  location: string | null;
  attendees: { name: string }[];
  guests: string[];
  notes: { author: string; body: string }[];
  raised: (IssueLike & { status: string })[];
  closedHere: IssueLike[];
}) {
  const people = [...m.attendees.map((a) => a.name), ...m.guests];
  const lines = [`*会议记录：${m.title}*`, `📅 ${whenText(m.startsAt, m.endsAt)}`];
  if (m.location) lines.push(`📍 ${m.location}`);
  lines.push(`👥 参加 ${people.length} 人：${people.join("、")}`);

  const notes = m.notes.filter((n) => n.body.trim());
  if (notes.length) {
    lines.push("", "*会议内容*");
    for (const n of notes) lines.push(`【${n.author}】`, n.body.trim());
  }

  const open = m.raised.filter((i) => i.status === "OPEN");
  const doneNow = [...m.raised.filter((i) => i.status === "DONE"), ...m.closedHere];
  if (open.length) {
    lines.push("", "*要解决的问题*");
    open.forEach((i, n) => lines.push(`${n + 1}. ${issueLine(i)}`));
  }
  if (doneNow.length) {
    lines.push("", "*已完成*");
    doneNow.forEach((i) => lines.push(`✅ ${i.title}${i.doneNote ? `：${i.doneNote}` : ""}`));
  }
  return lines.join("\n");
}
