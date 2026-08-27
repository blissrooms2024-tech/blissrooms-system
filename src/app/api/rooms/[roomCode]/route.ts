import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";

const patchSchema = z
  .object({
    status: z.enum(["VACANT", "OCCUPIED", "RESERVED", "MAINTENANCE"]).optional(),
    hasAircon: z.boolean().optional(),
  })
  .refine((d) => d.status !== undefined || d.hasAircon !== undefined, { message: "没有要改的东西" });

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ roomCode: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ success: false, message: "只有 Admin 可以改" }, { status: 403 });
  }
  const { roomCode } = await params;
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "资料不对" }, { status: 400 });
  }

  const existing = await prisma.room.findUnique({ where: { roomCode } });
  if (!existing) {
    return NextResponse.json({ success: false, message: "找不到这间房" }, { status: 404 });
  }

  const data: { status?: typeof parsed.data.status; hasAircon?: boolean } = {};
  if (parsed.data.status !== undefined) data.status = parsed.data.status;
  if (parsed.data.hasAircon !== undefined) data.hasAircon = parsed.data.hasAircon;
  await prisma.room.update({ where: { roomCode }, data });

  return NextResponse.json({ success: true, message: `✅ ${roomCode} 已更新` });
}
