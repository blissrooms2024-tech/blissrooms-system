import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import FinanceOverviewClient from "./FinanceOverviewClient";

export default async function FinancePage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (session.role !== "BOSS" && session.role !== "ADMIN") redirect("/dashboard");

  return <FinanceOverviewClient />;
}
