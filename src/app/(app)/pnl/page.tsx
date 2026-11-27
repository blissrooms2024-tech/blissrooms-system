import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import PnlClient from "./PnlClient";

export default async function PnlPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (!["BOSS", "ADMIN"].includes(session.role)) redirect("/dashboard");
  return <PnlClient />;
}
