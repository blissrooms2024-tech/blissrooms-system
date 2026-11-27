import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getDashboardData } from "@/lib/dashboard";
import { getQuoteOptions } from "@/lib/quoteOptions";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (session.role !== "BOSS" && session.role !== "ADMIN") redirect("/rooms");

  const [data, quoteOptions] = await Promise.all([getDashboardData({ id: session.sub, role: session.role }), getQuoteOptions()]);
  // Malaysia is UTC+8 all year, so the greeting's hour is worked out here rather than in the
  // browser — the server and the phone then render the same greeting.
  const hour = (new Date().getUTCHours() + 8) % 24;
  return (
    <DashboardClient data={data} quoteOptions={quoteOptions} role={session.role} name={session.name} userCode={session.userCode} hour={hour} />
  );
}
