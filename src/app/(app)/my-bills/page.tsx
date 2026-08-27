import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import MyBillsClient from "./MyBillsClient";

export default async function MyBillsPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (session.role !== "TENANT") redirect("/dashboard");

  return <MyBillsClient />;
}
