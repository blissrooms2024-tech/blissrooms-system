import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import ContractsClient from "./ContractsClient";
import ManageContracts from "./ManageContracts";

export default async function ContractsPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (!["BOSS", "ADMIN", "AGENT"].includes(session.role)) redirect("/my-tenancy");

  // Boss/Admin get the phone-friendly card list; Agents keep their current page for now.
  if (session.role === "AGENT") return <ContractsClient role={session.role} />;
  return <ManageContracts role={session.role} />;
}
