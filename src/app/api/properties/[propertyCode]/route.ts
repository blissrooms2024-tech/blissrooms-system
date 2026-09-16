import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ propertyCode: string }> }
) {
  const user = await getCurrentUser();
  if (!user || !["BOSS", "ADMIN", "AGENT"].includes(user.role)) {
    return NextResponse.json({ success: false, message: "没有权限" }, { status: 403 });
  }
  const { propertyCode } = await params;
  const property = await prisma.property.findUnique({
    where: { propertyCode },
    include: {
      rooms: {
        select: { roomCode: true, roomType: true, status: true, isCarpark: true },
        orderBy: { roomCode: "asc" },
      },
    },
  });
  if (!property) return NextResponse.json({ success: false, message: "找不到这个楼盘" }, { status: 404 });

  return NextResponse.json({
    success: true,
    property: {
      propertyCode: property.propertyCode,
      name: property.name,
      address: property.address,
      region: property.region,
      landlord: property.landlord,
      managementFeeRate: property.managementFeeRate ? Number(property.managementFeeRate) : null,
      ownerRentalAmount: property.ownerRentalAmount ? Number(property.ownerRentalAmount) : null,
      status: property.status,
      notes: property.notes,
      rooms: property.rooms,
    },
  });
}

const editSchema = z.object({
  name: z.string().trim().min(1),
  address: z.string().trim().optional().default(""),
  region: z.string().trim().optional().default(""),
  landlord: z.string().trim().optional().default(""),
  managementFeeRate: z.coerce.number().min(0).max(1).optional(),
  ownerRentalAmount: z.coerce.number().min(0).optional(),
  status: z.string().trim().optional().default("Active"),
  notes: z.string().trim().optional().default(""),
  roomCount: z.coerce.number().int().min(0).max(200).optional(),
  carparkCount: z.coerce.number().int().min(0).max(200).optional(),
});

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Finds the highest existing "-NN" / "-CPNN" suffix for this property's rooms so newly
// added rooms/carparks continue the sequence without colliding with codes that were
// manually renamed away from the default {code}-NN pattern.
async function nextSuffixNum(propertyId: string, propertyCode: string, isCarpark: boolean) {
  const rooms = await prisma.room.findMany({
    where: { propertyId, isCarpark },
    select: { roomCode: true },
  });
  const prefix = isCarpark ? `${propertyCode}-CP` : `${propertyCode}-`;
  const regex = new RegExp(`^${escapeRegExp(prefix)}(\\d+)$`);
  let max = 0;
  for (const r of rooms) {
    const m = r.roomCode.match(regex);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max + 1;
}

// Deletes down toward targetCount, removing only rooms with no tenant and no contract
// history (never touches an occupied or previously-contracted room), preferring to remove
// the highest-numbered ones first so the remaining sequence stays contiguous.
async function shrinkRooms(propertyId: string, propertyCode: string, isCarpark: boolean, targetCount: number) {
  const rooms = await prisma.room.findMany({
    where: { propertyId, isCarpark },
    select: { id: true, roomCode: true, currentTenantId: true },
  });
  const toRemoveCount = rooms.length - targetCount;
  if (toRemoveCount <= 0) return { removed: 0, kept: 0 };

  const contractCounts = await prisma.contract.groupBy({
    by: ["roomId"],
    where: { roomId: { in: rooms.map((r) => r.id) } },
    _count: { _all: true },
  });
  const contractedRoomIds = new Set(contractCounts.map((c) => c.roomId));

  const prefix = isCarpark ? `${propertyCode}-CP` : `${propertyCode}-`;
  const regex = new RegExp(`^${escapeRegExp(prefix)}(\\d+)$`);
  const eligible = rooms.filter((r) => !r.currentTenantId && !contractedRoomIds.has(r.id));
  eligible.sort((a, b) => {
    const na = a.roomCode.match(regex)?.[1];
    const nb = b.roomCode.match(regex)?.[1];
    if (na && nb) return parseInt(nb, 10) - parseInt(na, 10);
    if (na) return 1;
    if (nb) return -1;
    return b.roomCode.localeCompare(a.roomCode);
  });

  const toRemove = eligible.slice(0, toRemoveCount);
  if (toRemove.length > 0) {
    await prisma.room.deleteMany({ where: { id: { in: toRemove.map((r) => r.id) } } });
  }
  return { removed: toRemove.length, kept: toRemoveCount - toRemove.length };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ propertyCode: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ success: false, message: "只有 Admin 可以编辑" }, { status: 403 });
  }
  const { propertyCode } = await params;
  const parsed = editSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "楼盘名字一定要填" }, { status: 400 });
  }
  const existing = await prisma.property.findUnique({ where: { propertyCode } });
  if (!existing) return NextResponse.json({ success: false, message: "找不到这个楼盘" }, { status: 404 });

  const d = parsed.data;
  await prisma.property.update({
    where: { propertyCode },
    data: {
      name: d.name,
      address: d.address || null,
      region: d.region || null,
      landlord: d.landlord || null,
      // A unit is either managed-for-a-landlord-% or leased-from-owner-for-fixed-rent,
      // never both — owner rental (if given) wins.
      managementFeeRate: d.ownerRentalAmount ? null : d.managementFeeRate ?? null,
      ownerRentalAmount: d.ownerRentalAmount ?? null,
      status: d.status,
      notes: d.notes || null,
    },
  });

  if (d.name !== existing.name) {
    await prisma.room.updateMany({
      where: { OR: [{ propertyId: existing.id }, { propertyName: existing.name }] },
      data: { propertyName: d.name },
    });
  }

  let addedRooms = 0;
  let addedCarparks = 0;
  let removedRooms = 0;
  let removedCarparks = 0;
  let keptRooms = 0;
  let keptCarparks = 0;

  if (d.roomCount !== undefined) {
    const currentCount = await prisma.room.count({ where: { propertyId: existing.id, isCarpark: false } });
    if (d.roomCount > currentCount) {
      addedRooms = d.roomCount - currentCount;
      const start = await nextSuffixNum(existing.id, propertyCode, false);
      for (let i = 0; i < addedRooms; i++) {
        await prisma.room.create({
          data: {
            roomCode: `${propertyCode}-${String(start + i).padStart(2, "0")}`,
            propertyId: existing.id,
            propertyName: d.name,
            roomRental: 0,
            status: "VACANT",
          },
        });
      }
    } else if (d.roomCount < currentCount) {
      const result = await shrinkRooms(existing.id, propertyCode, false, d.roomCount);
      removedRooms = result.removed;
      keptRooms = result.kept;
    }
  }

  if (d.carparkCount !== undefined) {
    const currentCount = await prisma.room.count({ where: { propertyId: existing.id, isCarpark: true } });
    if (d.carparkCount > currentCount) {
      addedCarparks = d.carparkCount - currentCount;
      const start = await nextSuffixNum(existing.id, propertyCode, true);
      for (let i = 0; i < addedCarparks; i++) {
        await prisma.room.create({
          data: {
            roomCode: `${propertyCode}-CP${String(start + i).padStart(2, "0")}`,
            propertyId: existing.id,
            propertyName: d.name,
            roomType: "Carpark",
            roomRental: 0,
            isCarpark: true,
            status: "VACANT",
          },
        });
      }
    } else if (d.carparkCount < currentCount) {
      const result = await shrinkRooms(existing.id, propertyCode, true, d.carparkCount);
      removedCarparks = result.removed;
      keptCarparks = result.kept;
    }
  }

  const parts: string[] = [];
  if (addedRooms) parts.push(`新增了 ${addedRooms} 间房`);
  if (addedCarparks) parts.push(`新增了 ${addedCarparks} 个车位`);
  if (removedRooms) parts.push(`删除了 ${removedRooms} 间空房`);
  if (removedCarparks) parts.push(`删除了 ${removedCarparks} 个空车位`);
  if (keptRooms) parts.push(`⚠️ ${keptRooms} 间房有租客/合同记录，不能删`);
  if (keptCarparks) parts.push(`⚠️ ${keptCarparks} 个车位有租客/合同记录，不能删`);
  const extra = parts.length ? ` (${parts.join("、")})` : "";
  return NextResponse.json({ success: true, message: `✅ 楼盘已更新: ${d.name}${extra}` });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ propertyCode: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ success: false, message: "只有 Admin 可以删除" }, { status: 403 });
  }
  const { propertyCode } = await params;
  const existing = await prisma.property.findUnique({ where: { propertyCode } });
  if (!existing) return NextResponse.json({ success: false, message: "找不到这个楼盘" }, { status: 404 });

  const roomCount = await prisma.room.count({
    where: { OR: [{ propertyId: existing.id }, { propertyName: existing.name }] },
  });
  if (roomCount > 0) {
    return NextResponse.json(
      { success: false, message: "这个楼盘底下还有房间，请先删除或转移那些房间" },
      { status: 409 }
    );
  }

  await prisma.property.delete({ where: { propertyCode } });

  return NextResponse.json({ success: true, message: `✅ 楼盘已删除: ${existing.name}` });
}
