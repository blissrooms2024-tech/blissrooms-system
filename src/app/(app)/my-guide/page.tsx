import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import MyGuideClient from "./MyGuideClient";

export default async function MyGuidePage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  // Reference material only — any signed-in user can read it (staff use it to brief tenants).
  return <MyGuideClient />;
}
