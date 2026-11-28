import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/lib/auth/session";
import { MEETING_ROLES, isManager, meetingPeople } from "@/lib/meetings";
import { addDays, todayMY } from "@/lib/todoText";

/** 待办 — who can do what, and the data the page needs.
 *
 *  - Every staff account (Boss, Admin, Agent, Worker) keeps its own list.
 *  - Boss and Admin also see everyone's list, and can give someone a to-do (they get an email).
 *  - Ticking it done: the owner, whoever wrote it, Boss, Admin. Changing or deleting it: whoever
 *    wrote it, Boss, Admin — so a to-do from the Boss can't quietly get its date pushed back.
 *  - Open to-dos that are due today or late are emailed to their owner every morning at 8am.
 */

export const TODO_ROLES = MEETING_ROLES;
export const canUseTodos = (s: Pick<SessionPayload, "role">) => (TODO_ROLES as readonly string[]).includes(s.role);
export { isManager };

/** Staff a to-do can be given to (the same people as in meetings). */
export const todoPeople = meetingPeople;

/** Date-only columns hold UTC midnight of the Malaysian day. */
export const dayToDate = (day: string) => new Date(`${day}T00:00:00.000Z`);
const dayOf = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

const todoSelect = {
  todoCode: true,
  title: true,
  note: true,
  ownerId: true,
  owner: { select: { name: true, role: true } },
  dueDate: true,
  status: true,
  doneAt: true,
  doneByName: true,
  createdById: true,
  createdByName: true,
  createdAt: true,
} as const;

type TodoRow = {
  todoCode: string;
  title: string;
  note: string | null;
  ownerId: string;
  owner: { name: string; role: string };
  dueDate: Date | null;
  status: string;
  doneAt: Date | null;
  doneByName: string | null;
  createdById: string | null;
  createdByName: string;
  createdAt: Date;
};

/** A to-do for the page, with what this person may do to it. */
export function todoView(s: SessionPayload, t: TodoRow) {
  return {
    code: t.todoCode,
    title: t.title,
    note: t.note,
    ownerId: t.ownerId,
    owner: t.owner.name,
    ownerRole: t.owner.role as string,
    dueDate: dayOf(t.dueDate),
    status: t.status as "OPEN" | "DONE",
    doneAt: t.doneAt ? t.doneAt.toISOString() : null,
    doneByName: t.doneByName,
    /** Who gave it, when it isn't the owner's own. */
    givenBy: t.createdById === t.ownerId ? null : t.createdByName,
    createdAt: t.createdAt.toISOString(),
    canToggle: isManager(s) || t.ownerId === s.sub || t.createdById === s.sub,
    canEdit: isManager(s) || t.createdById === s.sub,
  };
}
export type TodoView = ReturnType<typeof todoView>;

/** How far back finished to-dos stay on the list. */
const DONE_DAYS = 14;
const recentlyDone = () => ({ status: "DONE", doneAt: { gte: dayToDate(addDays(todayMY(), -DONE_DAYS)) } });

/** My list: everything open, and what I finished in the last two weeks. */
export async function myTodos(s: SessionPayload) {
  const rows = await prisma.todo.findMany({
    where: { ownerId: s.sub, OR: [{ status: "OPEN" }, recentlyDone()] },
    orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
    take: 500,
    select: todoSelect,
  });
  return rows.map((t) => todoView(s, t));
}

/** Everyone's list (Boss / Admin): open to-dos, and what was finished in the last two weeks. */
export async function teamTodos(s: SessionPayload) {
  if (!isManager(s)) return [];
  const rows = await prisma.todo.findMany({
    where: { OR: [{ status: "OPEN" }, recentlyDone()] },
    orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
    take: 2000,
    select: todoSelect,
  });
  return rows.map((t) => todoView(s, t));
}

/** Open meeting items I handle or follow up — they're to-dos too. */
export async function myMeetingItems(s: SessionPayload) {
  const rows = await prisma.meetingIssue.findMany({
    where: { status: "OPEN", OR: [{ ownerId: s.sub }, { followUpId: s.sub }] },
    orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
    take: 200,
    select: { issueCode: true, title: true, dueDate: true, ownerId: true, meeting: { select: { meetingCode: true, title: true } } },
  });
  return rows.map((i) => ({
    code: i.issueCode,
    title: i.title,
    dueDate: dayOf(i.dueDate),
    as: (i.ownerId === s.sub ? "OWNER" : "FOLLOW_UP") as "OWNER" | "FOLLOW_UP",
    meetingCode: i.meeting.meetingCode,
    meetingTitle: i.meeting.title,
  }));
}
export type MeetingItem = Awaited<ReturnType<typeof myMeetingItems>>[number];

/** For the home page: my open to-dos (and how many are late), and — for Boss / Admin — how many
 * of the team's to-dos are late. */
export async function todoCounts(viewer: { id: string; role: string }) {
  const today = dayToDate(todayMY());
  const [mine, teamLate] = await Promise.all([
    prisma.todo.findMany({ where: { ownerId: viewer.id, status: "OPEN" }, select: { dueDate: true } }),
    viewer.role === "BOSS" || viewer.role === "ADMIN"
      ? prisma.todo.count({ where: { status: "OPEN", dueDate: { lt: today }, ownerId: { not: viewer.id } } })
      : Promise.resolve(0),
  ]);
  return { count: mine.length, overdue: mine.filter((t) => t.dueDate && t.dueDate < today).length, teamOverdue: teamLate };
}
