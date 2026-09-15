import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentUser();
  if (!session) redirect("/login");

  // An Agent can also be the tenant on their own contract — if so, their sidebar also
  // gets the tenant self-service menu items.
  const isAlsoTenant =
    session.role === "AGENT"
      ? (await prisma.contract.count({ where: { tenantId: session.sub } })) > 0
      : false;

  return (
    <AppShell
      user={{
        userCode: session.userCode,
        name: session.name,
        email: session.email,
        role: session.role,
        verified: session.verified,
      }}
      isAlsoTenant={isAlsoTenant}
    >
      {children}
    </AppShell>
  );
}
