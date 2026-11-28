import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { ROLE_HOME } from "@/lib/roleHome";
import UtilitiesClient from "./UtilitiesClient";

export default async function UtilitiesPage({ searchParams }: PageProps<"/utilities">) {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (session.role !== "BOSS" && session.role !== "ADMIN") redirect(ROLE_HOME[session.role] ?? "/login");
  const { period } = await searchParams;
  const initial = typeof period === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(period) ? period : null;
  return <UtilitiesClient isAdmin={session.role === "ADMIN"} initialPeriod={initial} />;
}
