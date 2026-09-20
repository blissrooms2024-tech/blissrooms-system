import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import AgentTenantsClient from "./AgentTenantsClient";

export default async function AgentTenantsPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (session.role !== "AGENT") redirect("/rooms");

  return <AgentTenantsClient />;
}
