import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { canUseMeetings, isManager } from "@/lib/meetings";
import { ROLE_HOME } from "@/lib/roleHome";
import MeetingsClient from "./MeetingsClient";

export default async function MeetingsPage({ searchParams }: PageProps<"/meetings">) {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (!canUseMeetings(session)) redirect(ROLE_HOME[session.role] ?? "/login");
  const sp = await searchParams;
  const tab = sp.tab === "mine" || sp.tab === "open" ? sp.tab : "meetings";
  return <MeetingsClient me={session.sub} isManager={isManager(session)} initialTab={tab} openNew={sp.new === "1"} />;
}
