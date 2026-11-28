import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";

const LIVE = ["ACTIVE", "PENDING_APPROVE", "PENDING_SIGN"] as const;

/**
 * GET /api/properties/tree — every live unit with its 楼盘 (condo), unit number and rooms, and
 * who is in each room (name, phone, contract), for the 楼盘 → 单位 → 房间 dropdowns.
 * Boss / Admin see every tenant; an Agent sees the rooms but only their own tenants.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !["BOSS", "ADMIN", "AGENT"].includes(user.role)) {
    return NextResponse.json({ success: false, message: "没有权限" }, { status: 403 });
  }

  const [units, contracts] = await Promise.all([
    prisma.property.findMany({
      where: { OR: [{ status: null }, { status: { not: "Inactive" } }] },
      select: {
        propertyCode: true,
        name: true,
        building: { select: { name: true } },
        info: { select: { unitNo: true } },
        rooms: { select: { roomCode: true, status: true, isCarpark: true, roomType: true }, orderBy: { roomCode: "asc" } },
      },
      orderBy: { propertyCode: "asc" },
    }),
    prisma.contract.findMany({
      where: { status: { in: [...LIVE] }, ...(user.role === "AGENT" ? { agentId: user.sub } : {}) },
      select: {
        contractCode: true,
        status: true,
        tenantName: true,
        contactNumber: true,
        room: { select: { roomCode: true } },
        carparkRoom: { select: { roomCode: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // The tenant now in a room: the live contract (signed beats still-being-signed), also for the
  // carpark that rides along on a room contract.
  type Tenant = { name: string; phone: string | null; contractCode: string; status: string };
  const byRoom = new Map<string, Tenant>();
  for (const c of contracts) {
    const t = { name: c.tenantName, phone: c.contactNumber, contractCode: c.contractCode, status: c.status };
    for (const code of [c.room?.roomCode, c.carparkRoom?.roomCode]) {
      if (!code) continue;
      const had = byRoom.get(code);
      if (!had || (had.status !== "ACTIVE" && c.status === "ACTIVE")) byRoom.set(code, t);
    }
  }

  return NextResponse.json({
    success: true,
    units: units.map((u) => ({
      propertyCode: u.propertyCode,
      name: u.name,
      building: u.building?.name ?? null,
      unitNo: u.info?.unitNo ?? null,
      rooms: u.rooms.map((r) => ({ ...r, tenant: byRoom.get(r.roomCode) ?? null })),
    })),
  });
}
