import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import WarningLetterComposeClient from "./WarningLetterComposeClient";

export default async function WarningLetterComposePage({
  params,
}: {
  params: Promise<{ contractId: string }>;
}) {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/contracts");

  const { contractId } = await params;
  return <WarningLetterComposeClient contractCode={contractId} />;
}
