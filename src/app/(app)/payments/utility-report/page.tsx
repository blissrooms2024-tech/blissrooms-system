import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import UtilityReportClient from "./UtilityReportClient";

export default async function UtilityReportPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (session.role !== "BOSS" && session.role !== "ADMIN") redirect("/dashboard");

  return <UtilityReportClient />;
}
