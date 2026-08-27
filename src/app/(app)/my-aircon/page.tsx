import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import MyAirconClient from "./MyAirconClient";

export default async function MyAirconPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (session.role !== "TENANT") redirect("/dashboard");

  return <MyAirconClient />;
}
