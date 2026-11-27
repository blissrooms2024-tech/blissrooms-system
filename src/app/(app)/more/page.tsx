import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { ROLE_HOME } from "@/lib/roleHome";
import MoreClient from "./MoreClient";

export default async function MorePage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (session.role !== "BOSS" && session.role !== "ADMIN") redirect(ROLE_HOME[session.role] ?? "/login");

  return <MoreClient user={{ name: session.name, email: session.email, role: session.role, userCode: session.userCode }} />;
}
