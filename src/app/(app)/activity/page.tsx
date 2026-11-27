import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import ActivityClient from "./ActivityClient";

export default async function ActivityPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (session.role !== "BOSS" && session.role !== "ADMIN") redirect("/dashboard");
  return <ActivityClient />;
}
