import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import MyMoveOutClient from "./MyMoveOutClient";

export default async function MyMoveOutPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (session.role !== "TENANT") redirect("/dashboard");

  return <MyMoveOutClient />;
}
