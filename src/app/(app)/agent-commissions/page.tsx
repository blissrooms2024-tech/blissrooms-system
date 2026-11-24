import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import AgentCommissionsClient from "./AgentCommissionsClient";

export default async function AgentCommissionsPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (!["ADMIN", "BOSS"].includes(session.role)) redirect("/dashboard");

  return <AgentCommissionsClient canAct={session.role === "ADMIN"} />;
}
