import { NextRequest, NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { withActivity } from "@/lib/activity";
import { newId } from "@/lib/id";
import { notifyTodoAssigned } from "@/lib/mail";
import { canUseTodos, dayToDate, isManager, myMeetingItems, myTodos, teamTodos, todoPeople } from "@/lib/todos";
import { todoSchema } from "@/lib/todoSchemas";

/** GET /api/todos — my list (plus my open meeting items); ?scope=team — everyone's (Boss / Admin). */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !canUseTodos(user)) return NextResponse.json({ success: false, message: "没有权限" }, { status: 403 });
  const manager = isManager(user);
  if (req.nextUrl.searchParams.get("scope") === "team") {
    if (!manager) return NextResponse.json({ success: false, message: "只有 Boss / Admin 可以看全部人的待办" }, { status: 403 });
    const [todos, people] = await Promise.all([teamTodos(user), todoPeople()]);
    return NextResponse.json({ success: true, todos, people });
  }
  const [todos, issues, people] = await Promise.all([myTodos(user), myMeetingItems(user), manager ? todoPeople() : Promise.resolve([])]);
  return NextResponse.json({ success: true, todos, issues, people, me: user.sub, manager });
}

/** POST /api/todos — add a to-do: your own, or (Boss / Admin) someone else's, who gets an email. */
async function handlePOST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !canUseTodos(user)) return NextResponse.json({ success: false, message: "没有权限" }, { status: 403 });
  const parsed = todoSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message ?? "资料不完整" }, { status: 400 });
  const d = parsed.data;

  const ownerId = d.ownerId || user.sub;
  let owner: { id: string; name: string; email: string } | null = null;
  if (ownerId !== user.sub) {
    if (!isManager(user)) return NextResponse.json({ success: false, message: "只有 Boss / Admin 可以给别人加待办" }, { status: 403 });
    if (!(await todoPeople()).some((p) => p.id === ownerId)) return NextResponse.json({ success: false, message: "这个人不在员工名单里" }, { status: 400 });
    owner = await prisma.user.findUnique({ where: { id: ownerId }, select: { id: true, name: true, email: true } });
  }

  const todoCode = await newId("TD");
  await prisma.todo.create({
    data: {
      todoCode,
      title: d.title,
      note: d.note || null,
      ownerId,
      dueDate: d.dueDate ? dayToDate(d.dueDate) : null,
      createdById: user.sub,
      createdByName: user.name,
    },
  });

  if (owner?.email) {
    const to = owner;
    after(() => notifyTodoAssigned(to, { todoCode, title: d.title, note: d.note || null, dueDate: d.dueDate || null }, user.name));
  }
  return NextResponse.json({
    success: true,
    message: owner ? `已给 ${owner.name}：${d.title}（已寄 email 通知）` : `已加待办：${d.title}`,
    todoCode,
  });
}

export const POST = withActivity(handlePOST);
