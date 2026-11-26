import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { canUseClaims } from "@/lib/claims";
import { ROLE_HOME } from "@/lib/roleHome";
import ClaimsClient from "./ClaimsClient";

export default async function ClaimsPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (!canUseClaims(session)) redirect(ROLE_HOME[session.role] ?? "/login");

  return <ClaimsClient role={session.role} />;
}
