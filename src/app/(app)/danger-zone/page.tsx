import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import DangerZoneClient from "./DangerZoneClient";

export default async function DangerZonePage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/dashboard");

  return <DangerZoneClient />;
}
