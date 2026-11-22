import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import VouchersClient from "./VouchersClient";

export default async function VouchersPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (!["ADMIN", "BOSS"].includes(session.role)) redirect("/dashboard");

  return <VouchersClient role={session.role} />;
}
