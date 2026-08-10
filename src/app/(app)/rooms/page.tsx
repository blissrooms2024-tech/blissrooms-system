import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import RoomsClient from "./RoomsClient";

export default async function RoomsPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");

  return <RoomsClient role={session.role} />;
}
