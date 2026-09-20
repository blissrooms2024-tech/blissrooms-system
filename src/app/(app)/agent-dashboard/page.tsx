import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import AgentDashboardClient from "./AgentDashboardClient";

export default async function AgentDashboardPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (session.role !== "AGENT") redirect("/rooms");

  return <AgentDashboardClient />;
}
