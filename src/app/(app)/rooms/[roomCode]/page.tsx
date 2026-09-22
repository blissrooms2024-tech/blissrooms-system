import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import RoomDetailClient from "./RoomDetailClient";

export default async function RoomDetailPage({
  params,
}: {
  params: Promise<{ roomCode: string }>;
}) {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (!["BOSS", "ADMIN", "AGENT"].includes(session.role)) redirect("/dashboard");

  const { roomCode } = await params;
  return <RoomDetailClient roomCode={roomCode} role={session.role} />;
}
