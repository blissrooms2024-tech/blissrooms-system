import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import ContractDetailClient from "./ContractDetailClient";

export default async function ContractDetailPage({
  params,
}: {
  params: Promise<{ contractId: string }>;
}) {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (!["BOSS", "ADMIN", "AGENT"].includes(session.role)) redirect("/my-tenancy");

  const { contractId } = await params;
  return <ContractDetailClient contractId={contractId} role={session.role} />;
}
