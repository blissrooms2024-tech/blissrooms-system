import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import AgentPayslipClient from "./AgentPayslipClient";

export default async function AgentPayslipPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (session.role !== "AGENT") redirect("/rooms");

  return <AgentPayslipClient />;
}
