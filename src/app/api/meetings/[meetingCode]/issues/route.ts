import { NextRequest, NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { withActivity } from "@/lib/activity";
import { newId } from "@/lib/id";
import { notifyMeetingIssue } from "@/lib/mail";
import { canUseMeetings, meetingAccess, meetingPeople } from "@/lib/meetings";
import { issueSchema } from "@/lib/meetingSchemas";

/** POST /api/meetings/MT-0001/issues — add an issue to sort out: who handles it, who follows it up.
 * Anyone in the meeting (and Boss / Admin) can add one; the people given it get an email. */
async function handlePOST(req: NextRequest, { params }: { params: Promise<{ meetingCode: string }> }) {
  const user = await getCurrentUser();
  if (!user || !canUseMeetings(user)) return NextResponse.json({ success: false, message: "没有权限" }, { status: 403 });
  const { meetingCode } = await params;
  const access = await meetingAccess(user, meetingCode);
  if (!access) return NextResponse.json({ success: false, message: "找不到这个会议" }, { status: 404 });
  if (!access.allowed) return NextResponse.json({ success: false, message: "你没有参加这个会议" }, { status: 403 });
  const parsed = issueSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message ?? "资料不完整" }, { status: 400 });
  const d = parsed.data;

  const people = new Map((await meetingPeople()).map((p) => [p.id, p]));
  if (d.ownerId && !people.has(d.ownerId)) return NextResponse.json({ success: false, message: "处理的人不在名单里" }, { status: 400 });
  if (d.followUpId && !people.has(d.followUpId)) return NextResponse.json({ success: false, message: "跟进的人不在名单里" }, { status: 400 });

  const issueCode = await newId("MI");
  await prisma.meetingIssue.create({
    data: {
      issueCode,
      meetingId: access.meeting.id,
      title: d.title,
      detail: d.detail || null,
      ownerId: d.ownerId || null,
      ownerName: d.ownerId ? null : d.ownerName || null,
      followUpId: d.followUpId || null,
      dueDate: d.dueDate ? new Date(`${d.dueDate}T00:00:00.000Z`) : null,
      createdById: user.sub,
      createdByName: user.name,
    },
  });

  // Let the people given it know (not whoever added it for themselves).
  const owner = d.ownerId ? people.get(d.ownerId)!.name : d.ownerName || null;
  const followUp = d.followUpId ? people.get(d.followUpId)!.name : null;
  const tell = [
    d.ownerId && d.ownerId !== user.sub ? { id: d.ownerId, as: "OWNER" as const } : null,
    d.followUpId && d.followUpId !== user.sub && d.followUpId !== d.ownerId ? { id: d.followUpId, as: "FOLLOW_UP" as const } : null,
  ].filter((x) => x !== null);
  if (tell.length) {
    const users = await prisma.user.findMany({ where: { id: { in: tell.map((x) => x.id) } }, select: { id: true, name: true, email: true } });
    after(async () => {
      for (const x of tell) {
        const u = users.find((v) => v.id === x.id);
        if (!u?.email) continue;
        await notifyMeetingIssue(
          u,
          { issueCode, title: d.title, detail: d.detail || null, dueDate: d.dueDate || null, owner, followUp },
          { meetingCode, title: access.meeting.title },
          x.as,
          user.name
        );
      }
    });
  }
  return NextResponse.json({ success: true, message: `已加问题：${d.title}`, issueCode });
}

export const POST = withActivity(handlePOST);
