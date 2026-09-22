import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import UnitDetailClient from "./UnitDetailClient";
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
  return (
    <div className="space-y-4">
      <UnitDetailClient propertyCode={propertyCode} />
      <UnitReportClient propertyCode={propertyCode} role={session.role} />
    </div>
  );
}
