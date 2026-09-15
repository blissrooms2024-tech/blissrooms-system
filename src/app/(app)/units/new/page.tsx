import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import NewUnitClient from "./NewUnitClient";

export default async function NewUnitPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/units");

  return <NewUnitClient />;
}
