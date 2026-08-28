import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";

/** Active (occupied, ACTIVE-contract) tenants under a Unit — feeds the bulk-bill picker so
 * Admin can select which rooms in this unit actually get charged. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ propertyCode: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ success: false, message: "只有 Admin 可以看" }, { status: 403 });
  }
  const { propertyCode } = await params;
  const property = await prisma.property.findUnique({ where: { propertyCode } });
  if (!property) return NextResponse.json({ success: false, message: "找不到这个楼盘" }, { status: 404 });

  // Match by propertyId, but also fall back to the denormalized propertyName string — some
  // rooms (e.g. imported from the old spreadsheet system) never got a propertyId FK set even
  // though their propertyName clearly identifies the unit, which silently hid their tenants
  // from this picker.
  const rooms = await prisma.room.findMany({
    where: { OR: [{ propertyId: property.id }, { propertyName: property.name }] },
  });
  const roomIds = rooms.map((r) => r.id);
  const roomById = new Map(rooms.map((r) => [r.id, r]));

  const contracts = roomIds.length
    ? await prisma.contract.findMany({
        where: { roomId: { in: roomIds }, status: "ACTIVE" },
        orderBy: { contractCode: "asc" },
      })
    : [];

  return NextResponse.json({
    success: true,
    tenants: contracts.map((c) => {
      const room = roomById.get(c.roomId);
      return {
        contractCode: c.contractCode,
        roomCode: room?.roomCode ?? "",
        tenantName: c.tenantName,
        hasAircon: room?.hasAircon ?? false,
      };
    }),
  });
}
