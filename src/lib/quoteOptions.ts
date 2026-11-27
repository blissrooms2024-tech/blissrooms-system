import { prisma } from "@/lib/prisma";

/** Rooms, vacant carparks and agents for the quick-quote form (Boss/Admin home page). */
export async function getQuoteOptions() {
  const activeProperty = { OR: [{ propertyId: null }, { property: { OR: [{ status: null }, { status: { not: "Inactive" } }] } }] };
  const [rooms, carparks, agents] = await Promise.all([
    prisma.room.findMany({
      where: { isCarpark: false, status: { not: "STORE" }, ...activeProperty },
      select: { roomCode: true, propertyId: true, propertyName: true, roomRental: true, carparkRental: true, status: true, roomType: true },
      orderBy: { roomCode: "asc" },
    }),
    prisma.room.findMany({
      where: { isCarpark: true, status: "VACANT", ...activeProperty },
      select: { roomCode: true, propertyId: true, roomRental: true, carparkRental: true, carparkLotNumber: true },
      orderBy: { roomCode: "asc" },
    }),
    prisma.user.findMany({
      where: { role: "AGENT", status: "ACTIVE" },
      select: { name: true, phone: true },
      orderBy: { name: "asc" },
    }),
  ]);
  return {
    rooms: rooms.map((r) => ({
      roomCode: r.roomCode,
      propertyId: r.propertyId,
      propertyName: r.propertyName,
      roomType: r.roomType,
      rent: Number(r.roomRental),
      carparkRent: Number(r.carparkRental),
      status: r.status,
    })),
    carparks: carparks.map((c) => ({
      roomCode: c.roomCode,
      propertyId: c.propertyId,
      // A standalone carpark's own price is its rental; fall back to the carpark field.
      rent: Number(c.roomRental) > 0 ? Number(c.roomRental) : Number(c.carparkRental),
      lot: c.carparkLotNumber,
    })),
    agents: agents.map((a) => ({ name: a.name, phone: a.phone })),
  };
}

export type QuoteOptions = Awaited<ReturnType<typeof getQuoteOptions>>;
