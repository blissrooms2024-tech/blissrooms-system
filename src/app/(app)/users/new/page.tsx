import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import NewUserClient from "./NewUserClient";

export default async function NewUserPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/dashboard");

  return <NewUserClient />;
}
