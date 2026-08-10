import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import AppShell from "@/components/AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentUser();
  if (!session) redirect("/login");

  return (
    <AppShell
      user={{
        userCode: session.userCode,
        name: session.name,
        email: session.email,
        role: session.role,
        verified: session.verified,
      }}
    >
      {children}
    </AppShell>
  );
}
