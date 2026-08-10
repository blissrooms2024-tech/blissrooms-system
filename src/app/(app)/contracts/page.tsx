import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import ContractsClient from "./ContractsClient";

export default async function ContractsPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (!["BOSS", "ADMIN", "AGENT"].includes(session.role)) redirect("/my-tenancy");

  return <ContractsClient role={session.role} />;
}
