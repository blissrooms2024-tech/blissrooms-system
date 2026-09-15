import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { ROLE_HOME } from "@/lib/roleHome";
import MyMoveOutClient from "./MyMoveOutClient";

export default async function MyMoveOutPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  // Agents can also be the tenant on their own contract, so they get access here too.
  if (session.role !== "TENANT" && session.role !== "AGENT") redirect(ROLE_HOME[session.role] ?? "/dashboard");

  return <MyMoveOutClient />;
}
