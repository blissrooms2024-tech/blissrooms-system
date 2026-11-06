import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import UserDetailClient from "./UserDetailClient";

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN" && session.role !== "BOSS") redirect("/dashboard");

  const { userId } = await params;
  return <UserDetailClient userId={userId} />;
}
