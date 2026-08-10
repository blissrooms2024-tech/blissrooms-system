import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import MyTenancyClient from "./MyTenancyClient";

export default async function MyTenancyPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (session.role !== "TENANT") redirect("/dashboard");

  return <MyTenancyClient />;
}
