import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import WarningLettersAdminClient from "./WarningLettersAdminClient";

export default async function WarningLettersPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (!["ADMIN", "BOSS"].includes(session.role)) redirect("/dashboard");

  return <WarningLettersAdminClient />;
}
