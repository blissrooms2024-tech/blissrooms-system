import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import RenewalClient from "./RenewalClient";

export default async function RenewalPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/contracts");

  return <RenewalClient />;
}
