import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { withActivity } from "@/lib/activity";
import { canUseMeetings, isManager, meetingPeople } from "@/lib/meetings";
import { issuePatchSchema } from "@/lib/meetingSchemas";

type Ctx = { params: Promise<{ issueCode: string }> };

async function load(issueCode: string) {
  return prisma.meetingIssue.findUnique({
    where: { issueCode },
    select: { id: true, title: true, status: true, ownerId: true, followUpId: true, createdById: true },
  });
}

/** PATCH — mark done / reopen (whoever handles or follows it up, whoever added it, Boss, Admin),
 * or change what it says and who has it (whoever added it, Boss, Admin). */
async function handlePATCH(req: NextRequest, { params }: Ctx) {
  const user = await getCurrentUser();
  if (!user || !canUseMeetings(user)) return NextResponse.json({ success: false, message: "没有权限" }, { status: 403 });
  const { issueCode } = await params;
  const issue = await load(issueCode);
  if (!issue) return NextResponse.json({ success: false, message: "找不到这个问题" }, { status: 404 });
  const parsed = issuePatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message ?? "资料不对" }, { status: 400 });
  const d = parsed.data;

  const involved = [issue.ownerId, issue.followUpId, issue.createdById].includes(user.sub);
  const canEdit = isManager(user) || issue.createdById === user.sub;

  if (d.status) {
    if (!isManager(user) && !involved) return NextResponse.json({ success: false, message: "只有处理、跟进的人或 Boss / Admin 可以改状态" }, { status: 403 });
    if (d.status === "DONE") {
      let doneMeetingId: string | null = null;
      if (d.meetingCode) {
        const m = await prisma.meeting.findUnique({ where: { meetingCode: d.meetingCode }, select: { id: true } });
        doneMeetingId = m?.id ?? null;
      }
      await prisma.meetingIssue.update({
        where: { id: issue.id },
        data: { status: "DONE", doneAt: new Date(), doneBy: user.name, doneNote: d.doneNote || null, doneMeetingId },
      });
      return NextResponse.json({ success: true, message: `已完成：${issue.title}` });
    }
    await prisma.meetingIssue.update({ where: { id: issue.id }, data: { status: "OPEN", doneAt: null, doneBy: null, doneNote: null, doneMeetingId: null } });
    return NextResponse.json({ success: true, message: `重新打开：${issue.title}` });
  }

  if (!canEdit) return NextResponse.json({ success: false, message: "只有加这个问题的人或 Boss / Admin 可以改" }, { status: 403 });
  const people = new Set((await meetingPeople()).map((p) => p.id));
  if (d.ownerId && !people.has(d.ownerId)) return NextResponse.json({ success: false, message: "处理的人不在名单里" }, { status: 400 });
  if (d.followUpId && !people.has(d.followUpId)) return NextResponse.json({ success: false, message: "跟进的人不在名单里" }, { status: 400 });
  await prisma.meetingIssue.update({
    where: { id: issue.id },
    data: {
      ...(d.title !== undefined ? { title: d.title } : {}),
      ...(d.detail !== undefined ? { detail: d.detail || null } : {}),
      ...(d.ownerId !== undefined || d.ownerName !== undefined ? { ownerId: d.ownerId || null, ownerName: d.ownerId ? null : d.ownerName || null } : {}),
      ...(d.followUpId !== undefined ? { followUpId: d.followUpId || null } : {}),
      ...(d.dueDate !== undefined ? { dueDate: d.dueDate ? new Date(`${d.dueDate}T00:00:00.000Z`) : null } : {}),
    },
  });
  return NextResponse.json({ success: true, message: "问题已更新" });
}

/** DELETE — remove an issue added by mistake (whoever added it, Boss, Admin). */
async function handleDELETE(_req: NextRequest, { params }: Ctx) {
  const user = await getCurrentUser();
  if (!user || !canUseMeetings(user)) return NextResponse.json({ success: false, message: "没有权限" }, { status: 403 });
  const { issueCode } = await params;
  const issue = await load(issueCode);
  if (!issue) return NextResponse.json({ success: false, message: "找不到这个问题" }, { status: 404 });
  if (!isManager(user) && issue.createdById !== user.sub) return NextResponse.json({ success: false, message: "只有加这个问题的人或 Boss / Admin 可以删" }, { status: 403 });
  await prisma.meetingIssue.delete({ where: { id: issue.id } });
  return NextResponse.json({ success: true, message: `已删除：${issue.title}` });
}

export const PATCH = withActivity(handlePATCH);
export const DELETE = withActivity(handleDELETE);
