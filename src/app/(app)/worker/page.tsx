import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import WorkerClient from "./WorkerClient";

export default async function WorkerPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (session.role !== "WORKER") redirect("/dashboard");

  return <WorkerClient />;
}
