import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { withActivity } from "@/lib/activity";
import { canUseMeetings, isManager, meetingAccess } from "@/lib/meetings";
import { noteSchema } from "@/lib/meetingSchemas";

/** PUT /api/meetings/MT-0001/note — save my own notes for the meeting (empty = remove them).
 * Everyone writes only their own; together they make the meeting's record. */
async function handlePUT(req: NextRequest, { params }: { params: Promise<{ meetingCode: string }> }) {
  const user = await getCurrentUser();
  if (!user || !canUseMeetings(user)) return NextResponse.json({ success: false, message: "没有权限" }, { status: 403 });
  const { meetingCode } = await params;
  const access = await meetingAccess(user, meetingCode);
  if (!access) return NextResponse.json({ success: false, message: "找不到这个会议" }, { status: 404 });
  if (!access.allowed) return NextResponse.json({ success: false, message: "你没有参加这个会议" }, { status: 403 });
  if (access.meeting.status !== "OPEN") return NextResponse.json({ success: false, message: "会议记录已经完成，备注不能再改" }, { status: 400 });
  const parsed = noteSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, message: "备注太长了" }, { status: 400 });

  const m = access.meeting;
  const body = parsed.data.body.trim();
  if (!body) {
    await prisma.meetingNote.deleteMany({ where: { meetingId: m.id, authorId: user.sub } });
    return NextResponse.json({ success: true, message: "已清除我的备注" });
  }
  await prisma.$transaction(async (tx) => {
    // Boss / Admin writing in a meeting they weren't listed for were there after all.
    if (!access.attending && isManager(user)) {
      await tx.meetingAttendee.upsert({
        where: { meetingId_userId: { meetingId: m.id, userId: user.sub } },
        create: { meetingId: m.id, userId: user.sub },
        update: {},
      });
    }
    await tx.meetingNote.upsert({
      where: { meetingId_authorId: { meetingId: m.id, authorId: user.sub } },
      create: { meetingId: m.id, authorId: user.sub, body },
      update: { body },
    });
  });
  return NextResponse.json({ success: true, message: "我的备注已保存" });
}

export const PUT = withActivity(handlePUT);
