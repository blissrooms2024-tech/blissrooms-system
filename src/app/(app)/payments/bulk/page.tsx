import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import BulkBillClient from "./BulkBillClient";

export default async function BulkBillPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/dashboard");

  return <BulkBillClient />;
}
