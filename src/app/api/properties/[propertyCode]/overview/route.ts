import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { signStepOf } from "@/lib/signStep";

/** GET /api/properties/[propertyCode]/overview — one unit at a glance, for the top of its page:
 * who it is, how full it is, what's waiting (signatures, leases ending, bills, repairs).
 * Boss / Admin / Agent. An Agent only gets their own contracts (same as everywhere else they
 * look) and no money. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ propertyCode: string }> }) {
  const user = await getCurrentUser();
  if (!user || !["BOSS", "ADMIN", "AGENT"].includes(user.role)) {
    return NextResponse.json({ success: false, message: "没有权限" }, { status: 403 });
  }
  const manager = user.role === "BOSS" || user.role === "ADMIN";
  const { propertyCode } = await params;
  const p = await prisma.property.findUnique({
    where: { propertyCode },
    select: {
      id: true,
      propertyCode: true,
      name: true,
      address: true,
      region: true,
      status: true,
      building: { select: { name: true } },
      info: { select: { unitNo: true } },
      rooms: { select: { roomCode: true, status: true, isCarpark: true } },
    },
  });
  if (!p) return NextResponse.json({ success: false, message: "找不到这个楼盘" }, { status: 404 });

  const today = new Date(`${new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10)}T00:00:00.000Z`);
  const in60 = new Date(today.getTime() + 60 * 86_400_000);
  const inUnit = { room: { propertyId: p.id } };

  const [contracts, bills, repairs] = await Promise.all([
    prisma.contract.findMany({
      where: { ...inUnit, status: { in: ["PENDING_APPROVE", "PENDING_SIGN", "ACTIVE"] }, ...(manager ? {} : { agentId: user.sub }) },
      select: {
        contractCode: true,
        tenantName: true,
        status: true,
        agentSignature: true,
        icFront: true,
        icBack: true,
        commencementDate: true,
        expiredDate: true,
        room: { select: { roomCode: true } },
      },
      orderBy: { room: { roomCode: "asc" } },
    }),
    // Same bills, same sums as the 未清账单 list: everything not Paid yet, slips in review
    // included, at the billed amount — so this tile, the 账单 tab and that list never disagree.
    manager
      ? prisma.payment.findMany({
          where: { contract: inUnit, status: { in: ["PENDING", "REJECTED", "PENDING_REVIEW"] } },
          select: { status: true, amountDue: true, dueDate: true },
        })
      : Promise.resolve([]),
    prisma.maintenanceRequest.count({ where: { contract: inUnit, status: { notIn: ["COMPLETED", "CANCELLED"] } } }),
  ]);

  const rooms = p.rooms.filter((r) => !r.isCarpark);
  const count = (s: string) => rooms.filter((r) => r.status === s).length;
  const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
  const sum = (list: { amountDue: unknown }[]) => list.reduce((s, b) => s + Number(b.amountDue), 0);
  // Late = still on the tenant (no slip, or slip rejected) after the due date — the list's 逾期.
  const late = bills.filter((b) => b.status !== "PENDING_REVIEW" && b.dueDate && b.dueDate < today);

  return NextResponse.json({
    success: true,
    property: {
      code: p.propertyCode,
      name: p.name,
      address: p.address,
      region: p.region,
      status: p.status,
      building: p.building?.name ?? null,
      unitNo: p.info?.unitNo ?? null,
    },
    rooms: {
      total: rooms.length,
      occupied: count("OCCUPIED"),
      vacant: count("VACANT"),
      reserved: count("RESERVED"),
      maintenance: count("MAINTENANCE"),
      carparks: p.rooms.length - rooms.length,
      vacantCodes: rooms.filter((r) => r.status === "VACANT").map((r) => r.roomCode).sort(),
    },
    contracts: {
      active: contracts.filter((c) => c.status === "ACTIVE").length,
      signing: contracts
        .filter((c) => c.status !== "ACTIVE")
        .map((c) => ({ code: c.contractCode, roomCode: c.room.roomCode, tenantName: c.tenantName, step: signStepOf(c), moveIn: day(c.commencementDate) })),
      ending: contracts
        .filter((c) => c.status === "ACTIVE" && c.expiredDate && c.expiredDate <= in60)
        .sort((a, b) => a.expiredDate!.getTime() - b.expiredDate!.getTime())
        .map((c) => ({ code: c.contractCode, roomCode: c.room.roomCode, tenantName: c.tenantName, end: day(c.expiredDate) })),
    },
    money: manager
      ? {
          unpaidCount: bills.length,
          unpaidAmount: sum(bills),
          lateCount: late.length,
          lateAmount: sum(late),
          reviewCount: bills.filter((b) => b.status === "PENDING_REVIEW").length,
        }
      : null,
    repairsOpen: repairs,
  });
}
