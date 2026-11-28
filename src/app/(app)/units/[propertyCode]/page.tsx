import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import PropertyHub from "./PropertyHub";
import { tabsFor, type HubTab } from "./tabs";

export default async function UnitPage({ params, searchParams }: PageProps<"/units/[propertyCode]">) {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (!["BOSS", "ADMIN", "AGENT"].includes(session.role)) redirect("/dashboard");

  const { propertyCode } = await params;
  const sp = await searchParams;
  // ?tab=contracts etc. opens that tab; anything this role can't see falls back to 概况.
  const allowed: readonly string[] = tabsFor(session.role).map((t) => t.key);
  const tab = typeof sp.tab === "string" && allowed.includes(sp.tab) ? (sp.tab as HubTab) : "overview";
  const period = typeof sp.period === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.period) ? sp.period : null;
  return <PropertyHub propertyCode={propertyCode} role={session.role} initialTab={tab} period={period} />;
}
