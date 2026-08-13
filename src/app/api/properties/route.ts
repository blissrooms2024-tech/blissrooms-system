import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { newId } from "@/lib/id";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !["BOSS", "ADMIN", "AGENT"].includes(user.role)) {
    return NextResponse.json({ success: false, message: "没有权限" }, { status: 403 });
  }

  const properties = await prisma.property.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { rooms: true } } },
  });

  return NextResponse.json({
    success: true,
    properties: properties.map((p) => ({
      propertyCode: p.propertyCode,
      name: p.name,
      address: p.address,
      region: p.region,
      landlord: p.landlord,
      managementFeeRate: p.managementFeeRate ? Number(p.managementFeeRate) : null,
      status: p.status,
      notes: p.notes,
      roomCount: p._count.rooms,
    })),
  });
}

const createSchema = z.object({
  name: z.string().trim().min(1),
  address: z.string().trim().optional().default(""),
  region: z.string().trim().optional().default(""),
  landlord: z.string().trim().optional().default(""),
  managementFeeRate: z.coerce.number().min(0).max(1).optional(),
  notes: z.string().trim().optional().default(""),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ success: false, message: "只有 Admin 可以建楼盘" }, { status: 403 });
  }
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "楼盘名字一定要填" }, { status: 400 });
  }
  const d = parsed.data;

  await prisma.property.create({
    data: {
      propertyCode: await newId("PPT"),
      name: d.name,
      address: d.address || null,
      region: d.region || null,
      landlord: d.landlord || null,
      managementFeeRate: d.managementFeeRate ?? null,
      notes: d.notes || null,
    },
  });

  return NextResponse.json({ success: true, message: `✅ 楼盘已建: ${d.name}` });
}
