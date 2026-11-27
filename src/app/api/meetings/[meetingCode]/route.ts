import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { withActivity } from "@/lib/activity";
import { canUseMeetings, isManager, meetingAccess, meetingDetail, meetingPeople } from "@/lib/meetings";
import { meetingPatchSchema } from "@/lib/meetingSchemas";

type Ctx = { params: Promise<{ meetingCode: string }> };

/** GET — the meeting with everyone's notes and its issues. */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const user = await getCurrentUser();
  if (!user || !canUseMeetings(user)) return NextResponse.json({ success: false, message: "没有权限" }, { status: 403 });
  const { meetingCode } = await params;
  const m = await meetingDetail(user, meetingCode);
  if (!m) return NextResponse.json({ success: false, message: "找不到这个会议，或你没有参加" }, { status: 404 });
  return NextResponse.json({ success: true, meeting: m });
}

/** PATCH — change when/where/who (whoever started it, Boss, Admin), finish the record, or
 * reopen it (Boss / Admin). */
async function handlePATCH(req: NextRequest, { params }: Ctx) {
  const user = await getCurrentUser();
  if (!user || !canUseMeetings(user)) return NextResponse.json({ success: false, message: "没有权限" }, { status: 403 });
  const { meetingCode } = await params;
  const access = await meetingAccess(user, meetingCode);
  if (!access) return NextResponse.json({ success: false, message: "找不到这个会议" }, { status: 404 });
  const parsed = meetingPatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message ?? "资料不对" }, { status: 400 });
  const d = parsed.data;
  const m = access.meeting;

  if (d.status === "OPEN" && m.status === "DONE") {
    if (!isManager(user)) return NextResponse.json({ success: false, message: "只有 Boss / Admin 可以重新打开" }, { status: 403 });
    await prisma.meeting.update({ where: { id: m.id }, data: { status: "OPEN", finishedAt: null, finishedBy: null } });
    return NextResponse.json({ success: true, message: "会议记录已重新打开，大家可以再写备注" });
  }
  if (!access.canEdit) return NextResponse.json({ success: false, message: "只有开会议记录的人或 Boss / Admin 可以改" }, { status: 403 });
  if (d.status === "DONE") {
    await prisma.meeting.update({ where: { id: m.id }, data: { status: "DONE", finishedAt: new Date(), finishedBy: user.name } });
    return NextResponse.json({ success: true, message: "会议记录已完成，备注不能再改；问题照样可以跟进" });
  }

  const startsAt = d.startsAt ? new Date(d.startsAt) : m.startsAt;
  const endsAt = d.endsAt === undefined ? undefined : d.endsAt ? new Date(d.endsAt) : null;
  if (endsAt && endsAt < startsAt) return NextResponse.json({ success: false, message: "结束时间比开始时间早" }, { status: 400 });

  await prisma.$transaction(async (tx) => {
    await tx.meeting.update({
      where: { id: m.id },
      data: {
        ...(d.title !== undefined ? { title: d.title } : {}),
        ...(d.startsAt !== undefined ? { startsAt } : {}),
        ...(endsAt !== undefined ? { endsAt } : {}),
        ...(d.location !== undefined ? { location: d.location || null } : {}),
        ...(d.guests !== undefined ? { guests: d.guests } : {}),
      },
    });
    if (d.attendeeIds !== undefined) {
      // Someone who already wrote notes stays in the meeting.
      const staff = new Set((await meetingPeople()).map((p) => p.id));
      const writers = (await tx.meetingNote.findMany({ where: { meetingId: m.id }, select: { authorId: true } })).map((n) => n.authorId);
      const keep = new Set([...d.attendeeIds.filter((id) => staff.has(id)), ...writers]);
      await tx.meetingAttendee.deleteMany({ where: { meetingId: m.id, userId: { notIn: [...keep] } } });
      const have = new Set((await tx.meetingAttendee.findMany({ where: { meetingId: m.id }, select: { userId: true } })).map((a) => a.userId));
      const add = [...keep].filter((id) => !have.has(id));
      if (add.length) await tx.meetingAttendee.createMany({ data: add.map((userId) => ({ meetingId: m.id, userId })) });
    }
  });
  return NextResponse.json({ success: true, message: "会议资料已更新" });
}

/** DELETE — remove a meeting record and its issues (Boss / Admin). */
async function handleDELETE(_req: NextRequest, { params }: Ctx) {
  const user = await getCurrentUser();
  if (!user || !isManager(user)) return NextResponse.json({ success: false, message: "只有 Boss / Admin 可以删除会议记录" }, { status: 403 });
  const { meetingCode } = await params;
  const m = await prisma.meeting.findUnique({ where: { meetingCode }, select: { id: true, title: true } });
  if (!m) return NextResponse.json({ success: false, message: "找不到这个会议" }, { status: 404 });
  await prisma.meeting.delete({ where: { id: m.id } });
  return NextResponse.json({ success: true, message: `已删除会议记录：${m.title}` });
}

export const PATCH = withActivity(handlePATCH);
export const DELETE = withActivity(handleDELETE);
