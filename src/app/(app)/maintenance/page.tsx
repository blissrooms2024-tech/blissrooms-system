import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import MaintenanceClient from "./MaintenanceClient";

export default async function MaintenancePage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (!["ADMIN", "BOSS"].includes(session.role)) redirect("/dashboard");

  return <MaintenanceClient canAct={session.role === "ADMIN"} />;
}
