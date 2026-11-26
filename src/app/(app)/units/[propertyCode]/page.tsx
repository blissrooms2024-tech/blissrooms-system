import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import UnitDetailClient from "./UnitDetailClient";
import UnitReportClient from "./UnitReportClient";
import UnitInfoClient from "./UnitInfoClient";

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
      {(session.role === "BOSS" || session.role === "ADMIN") && <UnitInfoClient propertyCode={propertyCode} />}
      <UnitReportClient propertyCode={propertyCode} role={session.role} />
    </div>
  );
}
