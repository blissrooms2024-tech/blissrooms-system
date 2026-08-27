import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import MyMoveInClient from "./MyMoveInClient";

export default async function MyMoveInPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (session.role !== "TENANT") redirect("/dashboard");

  return <MyMoveInClient />;
}
