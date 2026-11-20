import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import DuplicateCheckClient from "./DuplicateCheckClient";

export default async function DuplicateCheckPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/contracts");

  return <DuplicateCheckClient />;
}
