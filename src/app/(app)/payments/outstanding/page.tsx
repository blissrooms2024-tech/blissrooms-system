import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import OutstandingBillsClient from "./OutstandingBillsClient";

export default async function OutstandingBillsPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (!["ADMIN", "BOSS"].includes(session.role)) redirect("/dashboard");

  return <OutstandingBillsClient />;
}
