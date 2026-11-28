import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import UsersClient from "./UsersClient";

export default async function UsersPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN" && session.role !== "BOSS") redirect("/dashboard");

  return <UsersClient />;
}
