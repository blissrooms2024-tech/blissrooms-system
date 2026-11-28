import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import OutstandingBillsClient from "./OutstandingBillsClient";

export default async function OutstandingBillsPage({ searchParams }: PageProps<"/payments/outstanding">) {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (!["ADMIN", "BOSS"].includes(session.role)) redirect("/dashboard");

  // ?show=overdue opens the list already filtered (the home page's 逾期账单 row links here).
  const { show } = await searchParams;
  return <OutstandingBillsClient initialShow={show === "overdue" ? "overdue" : undefined} />;
}
