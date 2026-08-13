import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import ReviewQueueClient from "./ReviewQueueClient";

export default async function PaymentsReviewPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (!["ADMIN", "BOSS"].includes(session.role)) redirect("/dashboard");

  return <ReviewQueueClient canAct={session.role === "ADMIN"} />;
}
