import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import AgentCommissionClient from "./AgentCommissionClient";

export default async function AgentCommissionPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (session.role !== "AGENT") redirect("/rooms");

  return <AgentCommissionClient />;
}
