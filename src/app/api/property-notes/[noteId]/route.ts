import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { withActivity } from "@/lib/activity";
import { canEditNotes } from "@/lib/propertyNotes";

type Ctx = { params: Promise<{ noteId: string }> };

const patchSchema = z.object({ text: z.string().trim().min(1, "请写要注意什么").max(1000) });

/** PATCH — reword a 注意事项 (Boss, Admin). */
async function handlePATCH(req: NextRequest, { params }: Ctx) {
  const user = await getCurrentUser();
  if (!user || !canEditNotes(user)) return NextResponse.json({ success: false, message: "只有 Boss / Admin 可以改" }, { status: 403 });
  const { noteId } = await params;
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message ?? "资料不对" }, { status: 400 });
  const note = await prisma.propertyNote.findUnique({ where: { id: noteId }, select: { id: true } });
  if (!note) return NextResponse.json({ success: false, message: "找不到这条注意事项" }, { status: 404 });
  await prisma.propertyNote.update({ where: { id: noteId }, data: { text: parsed.data.text, updatedByName: user.name } });
  return NextResponse.json({ success: true, message: "已保存" });
}

/** DELETE — remove a 注意事项 (Boss, Admin). */
async function handleDELETE(_req: NextRequest, { params }: Ctx) {
  const user = await getCurrentUser();
  if (!user || !canEditNotes(user)) return NextResponse.json({ success: false, message: "只有 Boss / Admin 可以删" }, { status: 403 });
  const { noteId } = await params;
  const note = await prisma.propertyNote.findUnique({ where: { id: noteId }, select: { id: true } });
  if (!note) return NextResponse.json({ success: false, message: "找不到这条注意事项" }, { status: 404 });
  await prisma.propertyNote.delete({ where: { id: noteId } });
  return NextResponse.json({ success: true, message: "已删除" });
}

export const PATCH = withActivity(handlePATCH);
export const DELETE = withActivity(handleDELETE);
