import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { canUseMeetings, meetingPeople } from "@/lib/meetings";

/** GET /api/meetings/people — staff who can attend a meeting or be given an issue. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !canUseMeetings(user)) return NextResponse.json({ success: false, message: "没有权限" }, { status: 403 });
  return NextResponse.json({ success: true, people: await meetingPeople() });
}
