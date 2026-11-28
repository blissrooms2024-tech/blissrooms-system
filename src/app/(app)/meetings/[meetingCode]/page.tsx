import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { canUseMeetings } from "@/lib/meetings";
import { ROLE_HOME } from "@/lib/roleHome";
import MeetingClient from "./MeetingClient";

export default async function MeetingPage({ params }: PageProps<"/meetings/[meetingCode]">) {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (!canUseMeetings(session)) redirect(ROLE_HOME[session.role] ?? "/login");
  const { meetingCode } = await params;
  return <MeetingClient code={meetingCode} />;
}
