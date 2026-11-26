import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getDashboardData } from "@/lib/dashboard";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (session.role !== "BOSS" && session.role !== "ADMIN") redirect("/rooms");

  const data = await getDashboardData({ id: session.sub, role: session.role });
  return <DashboardClient data={data} role={session.role} name={session.name} />;
}
