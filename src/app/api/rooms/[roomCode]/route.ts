import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";

const statusSchema = z.object({
  status: z.enum(["VACANT", "OCCUPIED", "RESERVED", "MAINTENANCE"]),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ roomCode: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ success: false, message: "只有 Admin 可以改" }, { status: 403 });
  }
  const { roomCode } = await params;
  const parsed = statusSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "状态不对" }, { status: 400 });
  }

  const existing = await prisma.room.findUnique({ where: { roomCode } });
  if (!existing) {
    return NextResponse.json({ success: false, message: "找不到这间房" }, { status: 404 });
  }

  await prisma.room.update({ where: { roomCode }, data: { status: parsed.data.status } });

  return NextResponse.json({ success: true, message: `✅ ${roomCode} 已改成 ${parsed.data.status}` });
}
