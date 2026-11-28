import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/lib/auth/session";

/** 会议记录 — who can do what, and the data the pages need.
 *
 *  - Boss and Admin create meetings and see every meeting and issue.
 *  - Anyone with a staff account (Boss, Admin, Agent, Worker) who is added to a meeting sees it
 *    and writes their own notes from their own account; everyone's notes together are the record.
 *  - An issue is handled by someone (谁处理) and followed up by someone (谁跟进). It stays open,
 *    and shows up at the next meetings, until one of them (or Boss/Admin) marks it done.
 */

export const MEETING_ROLES = ["BOSS", "ADMIN", "AGENT", "WORKER"] as const;
export const canUseMeetings = (s: Pick<SessionPayload, "role">) => (MEETING_ROLES as readonly string[]).includes(s.role);
export const isManager = (s: Pick<SessionPayload, "role">) => s.role === "BOSS" || s.role === "ADMIN";

export const ROLE_ZH: Record<string, string> = { BOSS: "Boss", ADMIN: "Admin", AGENT: "Agent", WORKER: "师傅" };

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

/** Staff who can be added to a meeting or given an issue. */
export async function meetingPeople() {
  const users = await prisma.user.findMany({
    where: { role: { in: [...MEETING_ROLES] }, status: "ACTIVE" },
    select: { id: true, name: true, role: true },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });
  return users.map((u) => ({ id: u.id, name: u.name, role: u.role as string }));
}

/** The meetings this person may see: all for Boss/Admin, otherwise the ones they attend. */
export const visibleMeetings = (s: SessionPayload) => (isManager(s) ? {} : { attendees: { some: { userId: s.sub } } });

/** Issues this person may see: all for Boss/Admin; otherwise ones from meetings they attend, or
 * that they handle or follow up. */
export const visibleIssues = (s: SessionPayload) =>
  isManager(s) ? {} : { OR: [{ meeting: { attendees: { some: { userId: s.sub } } } }, { ownerId: s.sub }, { followUpId: s.sub }] };

const issueSelect = {
  issueCode: true,
  title: true,
  detail: true,
  ownerId: true,
  ownerName: true,
  owner: { select: { name: true } },
  followUpId: true,
  followUp: { select: { name: true } },
  dueDate: true,
  status: true,
  doneAt: true,
  doneBy: true,
  doneNote: true,
  createdById: true,
  createdByName: true,
  createdAt: true,
  meeting: { select: { meetingCode: true, title: true, startsAt: true } },
  doneMeeting: { select: { meetingCode: true, title: true, startsAt: true } },
} as const;

type IssueRow = {
  issueCode: string;
  title: string;
  detail: string | null;
  ownerId: string | null;
  ownerName: string | null;
  owner: { name: string } | null;
  followUpId: string | null;
  followUp: { name: string } | null;
  dueDate: Date | null;
  status: string;
  doneAt: Date | null;
  doneBy: string | null;
  doneNote: string | null;
  createdById: string;
  createdByName: string;
  createdAt: Date;
  meeting: { meetingCode: string; title: string; startsAt: Date };
  doneMeeting: { meetingCode: string; title: string; startsAt: Date } | null;
};

/** An issue for the pages, with what this person may do to it. */
export function issueView(s: SessionPayload, i: IssueRow) {
  const involved = i.ownerId === s.sub || i.followUpId === s.sub || i.createdById === s.sub;
  return {
    issueCode: i.issueCode,
    title: i.title,
    detail: i.detail,
    ownerId: i.ownerId,
    owner: i.owner?.name ?? i.ownerName ?? null,
    followUpId: i.followUpId,
    followUp: i.followUp?.name ?? null,
    dueDate: i.dueDate ? i.dueDate.toISOString().slice(0, 10) : null,
    status: i.status as "OPEN" | "DONE",
    doneAt: iso(i.doneAt),
    doneBy: i.doneBy,
    doneNote: i.doneNote,
    createdByName: i.createdByName,
    createdAt: i.createdAt.toISOString(),
    meeting: { code: i.meeting.meetingCode, title: i.meeting.title, startsAt: i.meeting.startsAt.toISOString() },
    doneMeeting: i.doneMeeting ? { code: i.doneMeeting.meetingCode, title: i.doneMeeting.title, startsAt: i.doneMeeting.startsAt.toISOString() } : null,
    mine: i.ownerId === s.sub || i.followUpId === s.sub,
    /** Mark done / reopen */
    canUpdate: isManager(s) || involved,
    /** Change what it says or who has it, or delete it */
    canEdit: isManager(s) || i.createdById === s.sub,
  };
}
export type IssueView = ReturnType<typeof issueView>;

/** The meetings list, newest first. */
export async function listMeetings(s: SessionPayload) {
  const rows = await prisma.meeting.findMany({
    where: visibleMeetings(s),
    orderBy: { startsAt: "desc" },
    take: 100,
    select: {
      meetingCode: true,
      title: true,
      startsAt: true,
      endsAt: true,
      location: true,
      status: true,
      guests: true,
      attendees: { select: { userId: true, user: { select: { name: true } } } },
      notes: { select: { authorId: true } },
      issues: { select: { status: true } },
      _count: { select: { issuesDone: true } },
    },
  });
  return rows.map((m) => ({
    code: m.meetingCode,
    title: m.title,
    startsAt: m.startsAt.toISOString(),
    endsAt: iso(m.endsAt),
    location: m.location,
    status: m.status as "OPEN" | "DONE",
    people: m.attendees.length + m.guests.length,
    names: [...m.attendees.map((a) => a.user.name), ...m.guests],
    notes: m.notes.length,
    /** I'm in it but haven't written my notes yet */
    myNoteMissing: m.status === "OPEN" && m.attendees.some((a) => a.userId === s.sub) && !m.notes.some((n) => n.authorId === s.sub),
    raised: m.issues.length,
    open: m.issues.filter((i) => i.status === "OPEN").length,
    closed: m._count.issuesDone,
  }));
}

/** Issues I handle or follow up — open ones first. */
export async function myIssues(s: SessionPayload) {
  const rows = await prisma.meetingIssue.findMany({
    where: { OR: [{ ownerId: s.sub }, { followUpId: s.sub }] },
    orderBy: [{ status: "desc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    take: 200,
    select: issueSelect,
  });
  return rows.map((i) => issueView(s, i));
}

/** Every open issue this person may see, oldest due first. */
export async function openIssues(s: SessionPayload) {
  const rows = await prisma.meetingIssue.findMany({
    where: { status: "OPEN", ...visibleIssues(s) },
    orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
    take: 300,
    select: issueSelect,
  });
  return rows.map((i) => issueView(s, i));
}

/** One meeting with everything on its page, or null if this person may not see it. */
export async function meetingDetail(s: SessionPayload, meetingCode: string) {
  const m = await prisma.meeting.findUnique({
    where: { meetingCode },
    select: {
      id: true,
      meetingCode: true,
      title: true,
      startsAt: true,
      endsAt: true,
      location: true,
      guests: true,
      status: true,
      createdById: true,
      createdByName: true,
      finishedAt: true,
      finishedBy: true,
      updatedAt: true,
      attendees: { select: { userId: true, user: { select: { name: true, role: true } } } },
      notes: { select: { authorId: true, author: { select: { name: true } }, body: true, createdAt: true, updatedAt: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!m) return null;
  const attending = m.attendees.some((a) => a.userId === s.sub);
  if (!isManager(s) && !attending) return null;

  const [raised, closedHere, carried] = await Promise.all([
    prisma.meetingIssue.findMany({ where: { meetingId: m.id }, orderBy: { createdAt: "asc" }, select: issueSelect }),
    prisma.meetingIssue.findMany({ where: { doneMeetingId: m.id, NOT: { meetingId: m.id } }, orderBy: { doneAt: "asc" }, select: issueSelect }),
    // Still open from earlier meetings — to go through at this one.
    prisma.meetingIssue.findMany({
      where: { status: "OPEN", meeting: { startsAt: { lt: m.startsAt } }, ...visibleIssues(s) },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
      take: 100,
      select: issueSelect,
    }),
  ]);

  const canEdit = isManager(s) || m.createdById === s.sub;
  return {
    code: m.meetingCode,
    title: m.title,
    startsAt: m.startsAt.toISOString(),
    endsAt: iso(m.endsAt),
    location: m.location,
    guests: m.guests,
    status: m.status as "OPEN" | "DONE",
    createdByName: m.createdByName,
    finishedAt: iso(m.finishedAt),
    finishedBy: m.finishedBy,
    updatedAt: m.updatedAt.toISOString(),
    attendees: m.attendees
      .map((a) => ({ id: a.userId, name: a.user.name, role: a.user.role as string }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    notes: m.notes.map((n) => ({
      authorId: n.authorId,
      author: n.author.name,
      body: n.body,
      createdAt: n.createdAt.toISOString(),
      updatedAt: n.updatedAt.toISOString(),
      mine: n.authorId === s.sub,
    })),
    raised: raised.map((i) => issueView(s, i)),
    closedHere: closedHere.map((i) => issueView(s, i)),
    carried: carried.map((i) => issueView(s, i)),
    me: { id: s.sub, name: s.name },
    attending,
    can: {
      edit: canEdit,
      /** Write my own notes — while the meeting is open */
      write: m.status === "OPEN" && (attending || isManager(s)),
      addIssue: attending || isManager(s),
      finish: canEdit && m.status === "OPEN",
      reopen: isManager(s) && m.status === "DONE",
      delete: isManager(s),
    },
  };
}
export type MeetingDetail = NonNullable<Awaited<ReturnType<typeof meetingDetail>>>;
export type MeetingRow = Awaited<ReturnType<typeof listMeetings>>[number];
export type Person = Awaited<ReturnType<typeof meetingPeople>>[number];

/** Who may add notes or issues to a meeting, by meeting code (for the write APIs). */
export async function meetingAccess(s: SessionPayload, meetingCode: string) {
  const m = await prisma.meeting.findUnique({
    where: { meetingCode },
    select: { id: true, meetingCode: true, title: true, startsAt: true, status: true, createdById: true, attendees: { select: { userId: true } } },
  });
  if (!m) return null;
  const attending = m.attendees.some((a) => a.userId === s.sub);
  return { meeting: m, attending, allowed: attending || isManager(s), canEdit: isManager(s) || m.createdById === s.sub };
}
