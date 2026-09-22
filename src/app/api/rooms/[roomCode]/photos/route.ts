import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { uploadDataUrl } from "@/lib/storage";

const postSchema = z.object({ dataUrl: z.string().min(1) });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomCode: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ success: false, message: "只有 Admin 可以上传房间照片" }, { status: 403 });
  }
  const { roomCode } = await params;
  const room = await prisma.room.findUnique({ where: { roomCode } });
  if (!room) return NextResponse.json({ success: false, message: "找不到这间房" }, { status: 404 });

  const parsed = postSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "请选一张图片" }, { status: 400 });
  }

  try {
    const url = await uploadDataUrl(parsed.data.dataUrl, `${roomCode}_ROOM_${Date.now()}.jpg`);
    const photos = [...room.photos, url];
    await prisma.room.update({ where: { roomCode }, data: { photos } });
    return NextResponse.json({ success: true, message: "✅ 照片已上传", photos });
  } catch (e) {
    return NextResponse.json(
      { success: false, message: "上传失败: " + (e instanceof Error ? e.message : String(e)) },
      { status: 500 }
    );
  }
}

const deleteSchema = z.object({ url: z.string().min(1) });

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ roomCode: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ success: false, message: "只有 Admin 可以删除房间照片" }, { status: 403 });
  }
  const { roomCode } = await params;
  const room = await prisma.room.findUnique({ where: { roomCode } });
  if (!room) return NextResponse.json({ success: false, message: "找不到这间房" }, { status: 404 });

  const parsed = deleteSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "缺少要删除的照片" }, { status: 400 });
  }

  const photos = room.photos.filter((p) => p !== parsed.data.url);
  await prisma.room.update({ where: { roomCode }, data: { photos } });
  return NextResponse.json({ success: true, message: "✅ 照片已删除", photos });
}
