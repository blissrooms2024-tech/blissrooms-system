import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import UnitsClient from "./UnitsClient";

export default async function UnitsPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (!["BOSS", "ADMIN", "AGENT"].includes(session.role)) redirect("/dashboard");

  return <UnitsClient role={session.role} />;
}
