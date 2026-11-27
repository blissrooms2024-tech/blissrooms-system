import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { canUseClaims } from "@/lib/claims";
import { ROLE_HOME } from "@/lib/roleHome";
import ClaimsClient from "./ClaimsClient";

export default async function ClaimsPage({ searchParams }: PageProps<"/claims">) {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (!canUseClaims(session)) redirect(ROLE_HOME[session.role] ?? "/login");
  const { new: openNew } = await searchParams;

  return <ClaimsClient role={session.role} openNew={openNew === "1"} />;
}
