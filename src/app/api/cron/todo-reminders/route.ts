import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendTodoDigest, sendTodoTeamWeekly } from "@/lib/mail";
import { TODO_ROLES, dayToDate } from "@/lib/todos";
import { digestOf, teamLate, todayMY, weekdayOf, type DigestIssue, type DigestTodo, type TeamLateItem } from "@/lib/todoText";

/** Vercel Cron, every morning at 8am Malaysia time (00:00 UTC; on Vercel's free plan it can land
 * any time in that hour).
 *
 * 1. Every staff member with an open to-do or meeting item that is due today or already late gets
 *    one email listing them. Nothing due → no email.
 * 2. On Mondays every Boss also gets the team's late items, one block per person.
 *
 * Each email is sent at most once per person per day (checked against the email log), so a
 * second run the same morning sends nothing new. */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ success: false, message: "unauthorized" }, { status: 401 });
  }

  // Outside production, ?day=YYYY-MM-DD runs it as if it were that morning (to try Monday's email).
  const asOf = process.env.NODE_ENV !== "production" ? req.nextUrl.searchParams.get("day") : null;
  const today = asOf && /^\d{4}-\d{2}-\d{2}$/.test(asOf) ? asOf : todayMY();
  const endOfToday = dayToDate(today); // due dates are stored as UTC midnight of the day
  const staff = await prisma.user.findMany({
    where: { role: { in: [...TODO_ROLES] }, status: "ACTIVE" },
    select: { id: true, userCode: true, name: true, email: true, role: true },
  });
  const ids = staff.map((u) => u.id);

  const [todos, issues] = await Promise.all([
    prisma.todo.findMany({
      where: { status: "OPEN", ownerId: { in: ids }, dueDate: { lte: endOfToday } },
      select: { todoCode: true, title: true, dueDate: true, ownerId: true, createdById: true, createdByName: true },
    }),
    prisma.meetingIssue.findMany({
      where: { status: "OPEN", dueDate: { lte: endOfToday }, OR: [{ ownerId: { in: ids } }, { followUpId: { in: ids } }] },
      select: { issueCode: true, title: true, dueDate: true, ownerId: true, followUpId: true, meeting: { select: { title: true } } },
    }),
  ]);
  const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

  // Already emailed today (a re-run, or Vercel firing twice)?
  const sentToday = new Set(
    (
      await prisma.log.findMany({
        // A send that failed doesn't count — the next run tries again.
        where: { type: { in: ["TodoDigest", "TodoTeamWeekly"] }, relatedId: { endsWith: `@${today}` }, NOT: { status: { startsWith: "failed" } } },
        select: { type: true, relatedId: true },
      })
    ).map(
      (l) => `${l.type}:${l.relatedId}`
    )
  );

  const result = { day: today, digests: 0, weekly: 0, skipped: 0, nothingDue: 0 };
  for (const u of staff) {
    const mine: DigestTodo[] = todos
      .filter((t) => t.ownerId === u.id)
      .map((t) => ({ code: t.todoCode, title: t.title, dueDate: day(t.dueDate), givenBy: t.createdById === u.id ? null : t.createdByName }));
    const items: DigestIssue[] = issues
      .filter((i) => i.ownerId === u.id || i.followUpId === u.id)
      .map((i) => ({ code: i.issueCode, title: i.title, dueDate: day(i.dueDate), meetingTitle: i.meeting.title, as: i.ownerId === u.id ? "OWNER" : "FOLLOW_UP" }));
    const d = digestOf(mine, items, today);
    if (!d.total) {
      result.nothingDue++;
      continue;
    }
    const key = `${u.userCode}@${today}`;
    if (!u.email || sentToday.has(`TodoDigest:${key}`)) {
      result.skipped++;
      continue;
    }
    await sendTodoDigest(u, d, key);
    result.digests++;
  }

  // Mondays: the Boss hears who is behind.
  if (weekdayOf(today) === 1) {
    const roleOf = new Map(staff.map((u) => [u.id, u]));
    const late: TeamLateItem[] = [
      ...todos.map((t) => ({ ownerId: t.ownerId, title: t.title, dueDate: day(t.dueDate), kind: "TODO" as const })),
      ...issues.flatMap((i) =>
        // An item handled by one person and followed up by another is late for both.
        [i.ownerId, i.followUpId]
          .filter((id, n, all): id is string => !!id && roleOf.has(id) && all.indexOf(id) === n)
          .map((id) => ({ ownerId: id, title: `${i.title}（会议「${i.meeting.title}」）`, dueDate: day(i.dueDate), kind: "MEETING" as const }))
      ),
    ].map((i) => ({ ...i, ownerName: roleOf.get(i.ownerId)!.name, ownerRole: roleOf.get(i.ownerId)!.role as string }));
    const groups = teamLate(late, today);
    if (groups.length) {
      for (const boss of staff.filter((u) => u.role === "BOSS" && u.email)) {
        const key = `${boss.userCode}@${today}`;
        if (sentToday.has(`TodoTeamWeekly:${key}`)) continue;
        await sendTodoTeamWeekly(boss, groups, key);
        result.weekly++;
      }
    }
  }

  return NextResponse.json({ success: true, ...result });
}
