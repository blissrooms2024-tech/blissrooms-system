import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import PayslipClient from "./PayslipClient";

export default async function WorkerPayslipPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (session.role !== "WORKER") redirect("/dashboard");

  return <PayslipClient />;
}
