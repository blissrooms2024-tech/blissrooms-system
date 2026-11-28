import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { withActivity } from "@/lib/activity";
import { cleanFurniture, readFurniture } from "@/lib/roomFurniture";

/** GET /api/rooms/[roomCode]/furniture — the room's furniture list and who confirmed it.
 * Boss / Admin / Agent (Agents show rooms to tenants). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ roomCode: string }> }) {
  const user = await getCurrentUser();
  if (!user || !["BOSS", "ADMIN", "AGENT"].includes(user.role)) {
    return NextResponse.json({ success: false, message: "没有权限" }, { status: 403 });
  }
  const { roomCode } = await params;
  const room = await prisma.room.findUnique({
    where: { roomCode },
    select: { isCarpark: true, furniture: true, furnitureConfirmedAt: true, furnitureConfirmedBy: true },
  });
  if (!room) return NextResponse.json({ success: false, message: "找不到这间房" }, { status: 404 });
  return NextResponse.json({
    success: true,
    isCarpark: room.isCarpark,
    items: readFurniture(room.furniture),
    confirmedAt: room.furnitureConfirmedAt,
    confirmedBy: room.furnitureConfirmedBy,
    canEdit: user.role === "BOSS" || user.role === "ADMIN",
  });
}

const schema = z.object({
  items: z.unknown(),
  /** 装修好了: the list is what the room really has now. */
  confirm: z.boolean().optional().default(false),
});

/** PUT /api/rooms/[roomCode]/furniture — Boss / Admin save the list (and confirm it). */
async function handlePUT(req: NextRequest, { params }: { params: Promise<{ roomCode: string }> }) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "BOSS" && user.role !== "ADMIN")) {
    return NextResponse.json({ success: false, message: "只有 Boss / Admin 可以改家具" }, { status: 403 });
  }
  const { roomCode } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, message: "资料格式不对" }, { status: 400 });
  const cleaned = cleanFurniture(parsed.data.items);
  if ("error" in cleaned) return NextResponse.json({ success: false, message: cleaned.error }, { status: 400 });

  const room = await prisma.room.findUnique({ where: { roomCode }, select: { id: true, isCarpark: true } });
  if (!room) return NextResponse.json({ success: false, message: "找不到这间房" }, { status: 404 });
  if (room.isCarpark) return NextResponse.json({ success: false, message: "车位没有家具" }, { status: 400 });

  // Editing the list after it was confirmed un-confirms it until someone checks the room again.
  await prisma.room.update({
    where: { id: room.id },
    data: {
      furniture: cleaned.items as object[],
      furnitureConfirmedAt: parsed.data.confirm ? new Date() : null,
      furnitureConfirmedBy: parsed.data.confirm ? user.name : null,
    },
  });
  return NextResponse.json({
    success: true,
    message: parsed.data.confirm
      ? `✅ ${roomCode} 家具已确认（${cleaned.items.length} 样）`
      : `${roomCode} 家具已保存（${cleaned.items.length} 样，还没确认）`,
  });
}

export const PUT = withActivity(handlePUT);
