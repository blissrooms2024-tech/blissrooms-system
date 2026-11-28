import { NextRequest, NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { withActivity } from "@/lib/activity";
import { notifyTodoAssigned } from "@/lib/mail";
import { canUseTodos, dayToDate, isManager, todoPeople } from "@/lib/todos";
import { todoPatchSchema } from "@/lib/todoSchemas";

type Ctx = { params: Promise<{ todoCode: string }> };

const load = (todoCode: string) =>
  prisma.todo.findUnique({
    where: { todoCode },
    select: { id: true, title: true, note: true, dueDate: true, status: true, ownerId: true, createdById: true },
  });

/** PATCH — tick done / reopen (the owner, whoever wrote it, Boss, Admin); change what it says or
 * when it's due (whoever wrote it, Boss, Admin); give it to someone else (Boss, Admin). */
async function handlePATCH(req: NextRequest, { params }: Ctx) {
  const user = await getCurrentUser();
  if (!user || !canUseTodos(user)) return NextResponse.json({ success: false, message: "没有权限" }, { status: 403 });
  const { todoCode } = await params;
  const todo = await load(todoCode);
  if (!todo) return NextResponse.json({ success: false, message: "找不到这项待办" }, { status: 404 });
  const parsed = todoPatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message ?? "资料不对" }, { status: 400 });
  const d = parsed.data;

  const manager = isManager(user);
  const canToggle = manager || todo.ownerId === user.sub || todo.createdById === user.sub;
  const canEdit = manager || todo.createdById === user.sub;

  if (d.status) {
    if (!canToggle) return NextResponse.json({ success: false, message: "这不是你的待办" }, { status: 403 });
    if (d.status === "DONE") {
      await prisma.todo.update({ where: { id: todo.id }, data: { status: "DONE", doneAt: new Date(), doneByName: user.name } });
      return NextResponse.json({ success: true, message: `完成：${todo.title}` });
    }
    await prisma.todo.update({ where: { id: todo.id }, data: { status: "OPEN", doneAt: null, doneByName: null } });
    return NextResponse.json({ success: true, message: `重新打开：${todo.title}` });
  }

  if (!canEdit) return NextResponse.json({ success: false, message: "只有写这项待办的人或 Boss / Admin 可以改" }, { status: 403 });
  let newOwner: { id: string; name: string; email: string } | null = null;
  if (d.ownerId && d.ownerId !== todo.ownerId) {
    if (!manager) return NextResponse.json({ success: false, message: "只有 Boss / Admin 可以把待办给别人" }, { status: 403 });
    if (!(await todoPeople()).some((p) => p.id === d.ownerId)) return NextResponse.json({ success: false, message: "这个人不在员工名单里" }, { status: 400 });
    newOwner = await prisma.user.findUnique({ where: { id: d.ownerId }, select: { id: true, name: true, email: true } });
  }

  const updated = await prisma.todo.update({
    where: { id: todo.id },
    data: {
      ...(d.title !== undefined ? { title: d.title } : {}),
      ...(d.note !== undefined ? { note: d.note || null } : {}),
      ...(d.dueDate !== undefined ? { dueDate: d.dueDate ? dayToDate(d.dueDate) : null } : {}),
      // Whoever hands it over is now the one who "gave" it (and may change it).
      ...(newOwner ? { ownerId: newOwner.id, createdById: user.sub, createdByName: user.name } : {}),
    },
    select: { title: true, note: true, dueDate: true },
  });

  // Handed to someone new (not to yourself): they hear about it, like a fresh one.
  if (newOwner?.email && newOwner.id !== user.sub) {
    const to = newOwner;
    after(() =>
      notifyTodoAssigned(to, { todoCode, title: updated.title, note: updated.note, dueDate: updated.dueDate ? updated.dueDate.toISOString().slice(0, 10) : null }, user.name)
    );
  }
  return NextResponse.json({ success: true, message: newOwner ? `已改给 ${newOwner.name}` : "已保存" });
}

/** DELETE — remove a to-do (whoever wrote it, Boss, Admin). */
async function handleDELETE(_req: NextRequest, { params }: Ctx) {
  const user = await getCurrentUser();
  if (!user || !canUseTodos(user)) return NextResponse.json({ success: false, message: "没有权限" }, { status: 403 });
  const { todoCode } = await params;
  const todo = await load(todoCode);
  if (!todo) return NextResponse.json({ success: false, message: "找不到这项待办" }, { status: 404 });
  if (!isManager(user) && todo.createdById !== user.sub) return NextResponse.json({ success: false, message: "只有写这项待办的人或 Boss / Admin 可以删" }, { status: 403 });
  await prisma.todo.delete({ where: { id: todo.id } });
  return NextResponse.json({ success: true, message: `已删除：${todo.title}` });
}

export const PATCH = withActivity(handlePATCH);
export const DELETE = withActivity(handleDELETE);
