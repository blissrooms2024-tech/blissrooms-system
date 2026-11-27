import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { ROLE_HOME } from "@/lib/roleHome";
import UnitBillingClient from "./UnitBillingClient";

export default async function UnitBillingPage({ params, searchParams }: PageProps<"/utilities/[propertyCode]">) {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (session.role !== "BOSS" && session.role !== "ADMIN") redirect(ROLE_HOME[session.role] ?? "/login");
  const { propertyCode } = await params;
  const sp = await searchParams;
  const period = typeof sp.period === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.period) ? sp.period : null;
  return <UnitBillingClient propertyCode={propertyCode} initialPeriod={period} openSetup={sp.setup === "1"} isAdmin={session.role === "ADMIN"} />;
}
