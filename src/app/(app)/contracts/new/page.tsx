import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import NewContractClient from "./NewContractClient";

export default async function NewContractPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (!["ADMIN", "AGENT"].includes(session.role)) redirect("/contracts");

  return <NewContractClient role={session.role} />;
}
