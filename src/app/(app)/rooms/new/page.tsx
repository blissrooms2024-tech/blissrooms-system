import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import NewRoomClient from "./NewRoomClient";

export default async function NewRoomPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/rooms");

  return <NewRoomClient />;
}
