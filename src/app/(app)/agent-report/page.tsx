import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import AgentReportClient from "./AgentReportClient";

export default async function AgentReportPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (session.role !== "AGENT") redirect("/rooms");

  return <AgentReportClient />;
}
