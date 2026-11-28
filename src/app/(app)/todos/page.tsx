import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { ROLE_HOME } from "@/lib/roleHome";
import { canUseTodos, isManager } from "@/lib/todos";
import TodosClient from "./TodosClient";

export default async function TodosPage({ searchParams }: PageProps<"/todos">) {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (!canUseTodos(session)) redirect(ROLE_HOME[session.role] ?? "/login");

  // ?tab=team opens everyone's list (Boss / Admin); ?new=1 opens the add sheet straight away.
  const { tab, new: startNew } = await searchParams;
  const manager = isManager(session);
  return <TodosClient me={session.sub} manager={manager} initialTab={manager && tab === "team" ? "team" : "mine"} startNew={startNew === "1"} />;
}
