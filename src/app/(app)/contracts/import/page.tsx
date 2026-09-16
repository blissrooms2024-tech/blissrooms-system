import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import ImportLegacyClient from "./ImportLegacyClient";

export default async function ImportLegacyPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/contracts");

  return <ImportLegacyClient />;
}
