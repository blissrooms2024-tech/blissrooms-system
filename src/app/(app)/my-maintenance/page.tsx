import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import MyMaintenanceClient from "./MyMaintenanceClient";

export default async function MyMaintenancePage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (session.role !== "TENANT") redirect("/dashboard");

  return <MyMaintenanceClient />;
}
