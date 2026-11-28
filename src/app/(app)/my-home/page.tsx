import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { ROLE_HOME } from "@/lib/roleHome";
import TenantHomeClient from "./TenantHomeClient";

export default async function TenantHomePage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (session.role !== "TENANT") redirect(ROLE_HOME[session.role] ?? "/login");
  // Malaysia is UTC+8 all year — work the greeting's hour out here so server and phone agree.
  const utc = new Date();
  const hour = (utc.getUTCHours() + 8) % 24;
  const today = new Date(utc.getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10);
  return <TenantHomeClient name={session.name} userCode={session.userCode} hour={hour} today={today} />;
}
