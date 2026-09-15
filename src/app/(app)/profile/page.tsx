import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import ProfileClient from "./ProfileClient";

export default async function ProfilePage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");

  return <ProfileClient />;
}
