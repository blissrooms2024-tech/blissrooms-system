/** 待办 — the date rules, shared by the page, the API and the morning email so they always agree.
 * Days are Malaysian calendar days written "YYYY-MM-DD". Nothing here touches the database. */

const DAY_MS = 86_400_000;
const MY_OFFSET_MS = 8 * 3600_000;

export const todayMY = (now: number = Date.now()) => new Date(now + MY_OFFSET_MS).toISOString().slice(0, 10);
export const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
/** How many days from `from` to `to` (negative when `to` is earlier). */
export const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
/** Monday = 1 … Sunday = 7 */
export const weekdayOf = (day: string) => new Date(`${day}T00:00:00Z`).getUTCDay() || 7;
/** The coming Monday (a week on, when today is Monday). */
export const nextMonday = (day: string) => addDays(day, 8 - weekdayOf(day));

export type Bucket = "OVERDUE" | "TODAY" | "LATER" | "NODATE" | "DONE";

export function bucketOf(t: { status: string; dueDate: string | null }, today: string): Bucket {
  if (t.status === "DONE") return "DONE";
  if (!t.dueDate) return "NODATE";
  const d = daysBetween(today, t.dueDate);
  return d < 0 ? "OVERDUE" : d === 0 ? "TODAY" : "LATER";
}

const WEEKDAY_ZH = ["", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"];
const WEEKDAY_EN = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** dd/mm, with the year only when it isn't this year's. */
export function shortDate(day: string, today: string) {
  const dm = `${day.slice(8, 10)}/${day.slice(5, 7)}`;
  return day.slice(0, 4) === today.slice(0, 4) ? dm : `${dm}/${day.slice(0, 4)}`;
}

/** How a due day reads next to a to-do, and how loud it should be. */
export function dueLabel(due: string | null, today: string, en: boolean): { text: string; tone: "rose" | "amber" | "gray" } | null {
  if (!due) return null;
  const d = daysBetween(today, due);
  if (d < 0) return { text: en ? `${-d}d late` : `迟了 ${-d} 天`, tone: "rose" };
  if (d === 0) return { text: en ? "Today" : "今天", tone: "amber" };
  if (d === 1) return { text: en ? "Tomorrow" : "明天", tone: "gray" };
  if (d <= 6) return { text: (en ? WEEKDAY_EN : WEEKDAY_ZH)[weekdayOf(due)], tone: "gray" };
  return { text: shortDate(due, today), tone: "gray" };
}

/** Full date for emails: 28/11/2026（星期六） */
export const longDateZh = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(0, 4)}（${WEEKDAY_ZH[weekdayOf(day)]}）`;

// --- The morning email -------------------------------------------------------------------------

export interface DigestTodo {
  code: string;
  title: string;
  dueDate: string;
  /** Who gave it, when it wasn't the owner's own. */
  givenBy: string | null;
}
export interface DigestIssue {
  code: string;
  title: string;
  dueDate: string;
  meetingTitle: string;
  as: "OWNER" | "FOLLOW_UP";
}
export interface Digest {
  overdue: (DigestTodo & { daysLate: number })[];
  dueToday: DigestTodo[];
  issues: (DigestIssue & { daysLate: number })[];
  total: number;
}

/** What goes in one person's 8am email: open to-dos and meeting items that are due today or
 * already late (oldest first). Nothing due and nothing late means no email at all. */
export function digestOf(todos: DigestTodo[], issues: DigestIssue[], today: string): Digest {
  const late = (due: string) => daysBetween(due, today);
  const byDue = <T extends { dueDate: string }>(a: T, b: T) => a.dueDate.localeCompare(b.dueDate);
  const overdue = todos.filter((t) => late(t.dueDate) > 0).sort(byDue).map((t) => ({ ...t, daysLate: late(t.dueDate) }));
  const dueToday = todos.filter((t) => late(t.dueDate) === 0);
  const items = issues.filter((i) => late(i.dueDate) >= 0).sort(byDue).map((i) => ({ ...i, daysLate: late(i.dueDate) }));
  return { overdue, dueToday, issues: items, total: overdue.length + dueToday.length + items.length };
}

// --- Monday's team email to the Boss -------------------------------------------------------------

export interface TeamLateItem {
  ownerId: string;
  ownerName: string;
  ownerRole: string;
  title: string;
  dueDate: string;
  kind: "TODO" | "MEETING";
}

/** Everyone's late items, one group per person, the most behind first. */
export function teamLate(items: TeamLateItem[], today: string) {
  const groups = new Map<string, { name: string; role: string; items: (TeamLateItem & { daysLate: number })[] }>();
  for (const i of items) {
    const daysLate = daysBetween(i.dueDate, today);
    if (daysLate <= 0) continue;
    const g = groups.get(i.ownerId) ?? { name: i.ownerName, role: i.ownerRole, items: [] };
    g.items.push({ ...i, daysLate });
    groups.set(i.ownerId, g);
  }
  return [...groups.values()]
    .map((g) => ({ ...g, items: g.items.sort((a, b) => b.daysLate - a.daysLate) }))
    .sort((a, b) => b.items.length - a.items.length || b.items[0].daysLate - a.items[0].daysLate || a.name.localeCompare(b.name));
}
