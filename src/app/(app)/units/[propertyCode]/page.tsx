import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import UnitReportClient from "./UnitReportClient";

export default async function UnitReportPage({
  params,
}: {
  params: Promise<{ propertyCode: string }>;
}) {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (!["BOSS", "ADMIN", "AGENT"].includes(session.role)) redirect("/dashboard");

  const { propertyCode } = await params;
  return <UnitReportClient propertyCode={propertyCode} />;
}
