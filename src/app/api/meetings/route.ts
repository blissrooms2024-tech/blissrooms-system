import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { withActivity } from "@/lib/activity";
import { newId } from "@/lib/id";
import { canUseMeetings, isManager, listMeetings, meetingPeople, myIssues, openIssues } from "@/lib/meetings";
import { meetingSchema } from "@/lib/meetingSchemas";

/** GET /api/meetings — the meetings I can see, my issues, and (Boss/Admin) every open issue. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !canUseMeetings(user)) return NextResponse.json({ success: false, message: "没有权限" }, { status: 403 });
  const [meetings, mine, open] = await Promise.all([listMeetings(user), myIssues(user), openIssues(user)]);
  return NextResponse.json({ success: true, meetings, mine, open, isManager: isManager(user) });
}

/** POST /api/meetings — Boss / Admin start a meeting record. */
async function handlePOST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !isManager(user)) return NextResponse.json({ success: false, message: "只有 Boss / Admin 可以开会议记录" }, { status: 403 });
  const parsed = meetingSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message ?? "资料不完整" }, { status: 400 });
  const d = parsed.data;
  const startsAt = new Date(d.startsAt);
  const endsAt = d.endsAt ? new Date(d.endsAt) : null;
  if (endsAt && endsAt < startsAt) return NextResponse.json({ success: false, message: "结束时间比开始时间早" }, { status: 400 });

  const staff = new Set((await meetingPeople()).map((p) => p.id));
  const attendeeIds = [...new Set([user.sub, ...d.attendeeIds])].filter((id) => staff.has(id) || id === user.sub);
  const meetingCode = await newId("MT");
  await prisma.meeting.create({
    data: {
      meetingCode,
      title: d.title,
      startsAt,
      endsAt,
      location: d.location || null,
      guests: d.guests,
      createdById: user.sub,
      createdByName: user.name,
      attendees: { create: attendeeIds.map((userId) => ({ userId })) },
    },
  });
  return NextResponse.json({ success: true, message: `已开会议记录：${d.title}`, code: meetingCode });
}

export const POST = withActivity(handlePOST);
