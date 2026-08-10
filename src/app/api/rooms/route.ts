import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ success: false, message: "请重新登录" }, { status: 401 });

  const rooms = await prisma.room.findMany({
    where: user.role === "AGENT" ? { status: "VACANT" } : undefined,
    orderBy: { roomCode: "asc" },
  });

  return NextResponse.json({
    success: true,
    rooms: rooms.map((r) => ({
      roomCode: r.roomCode,
      propertyName: r.propertyName,
      roomType: r.roomType,
      roomRental: Number(r.roomRental),
      carparkRental: Number(r.carparkRental),
      status: r.status,
      currentTenantId: r.currentTenantId,
      currentContractId: r.currentContractId,
      notes: r.notes,
    })),
  });
}

const addSchema = z.object({
  roomCode: z.string().trim().min(1),
  propertyName: z.string().trim().default(""),
  roomType: z.string().trim().default(""),
  roomRental: z.coerce.number().min(0).default(0),
  carparkRental: z.coerce.number().min(0).default(0),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ success: false, message: "只有 Admin 可以加房" }, { status: 403 });
  }
  const parsed = addSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "Room Code 不能空" }, { status: 400 });
  }
  const d = parsed.data;

  const existing = await prisma.room.findUnique({ where: { roomCode: d.roomCode } });
  if (existing) {
    return NextResponse.json({ success: false, message: "这个 Room Code 已经存在了" }, { status: 409 });
  }

  await prisma.room.create({
    data: {
      roomCode: d.roomCode,
      propertyName: d.propertyName,
      roomType: d.roomType,
      roomRental: d.roomRental,
      carparkRental: d.carparkRental,
      status: "VACANT",
    },
  });

  return NextResponse.json({ success: true, message: `✅ 房间已加: ${d.roomCode}` });
}
