import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { nextDueDate } from "@/lib/unitInfo";
import { maskInfo, parseInfoUpdate, requireUnitInfoAccess } from "@/lib/unitInfoServer";

type Ctx = { params: Promise<{ propertyCode: string }> };

/** Unit info for Boss/Admin: details (passwords masked), access cards, utility accounts. */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const auth = await requireUnitInfoAccess((await params).propertyCode);
  if (auth instanceof NextResponse) return auth;
  const { property } = auth;

  const [info, cards, utilities, rooms, views] = await Promise.all([
    prisma.propertyInfo.findUnique({ where: { propertyId: property.id } }),
    prisma.accessCard.findMany({
      where: { propertyId: property.id },
      include: { room: { select: { roomCode: true, currentTenant: { select: { name: true } } } } },
      orderBy: [{ cardType: "asc" }, { serialNo: "asc" }],
    }),
    prisma.utilityAccount.findMany({ where: { propertyId: property.id }, orderBy: { utilityType: "asc" } }),
    prisma.room.findMany({
      where: { propertyId: property.id },
      select: { roomCode: true, isCarpark: true },
      orderBy: { roomCode: "asc" },
    }),
    prisma.log.findMany({
      where: { type: "SECRET_VIEW", relatedId: property.propertyCode },
      orderBy: { timestamp: "desc" },
      take: 5,
      select: { timestamp: true, triggeredBy: true },
    }),
  ]);

  const { values, secretsSet } = maskInfo(info as Record<string, unknown> | null);

  return NextResponse.json({
    success: true,
    values,
    secretsSet,
    photos: info?.photos ?? [],
    updatedAt: info?.updatedAt ?? null,
    updatedBy: info?.updatedBy ?? null,
    roomCount: rooms.filter((r) => !r.isCarpark).length,
    carparkCount: rooms.filter((r) => r.isCarpark).length,
    rooms: rooms.map((r) => r.roomCode),
    cards: serialize(
      cards.map((c) => ({
        id: c.id,
        cardType: c.cardType,
        serialNo: c.serialNo,
        holder: c.holder,
        roomCode: c.room?.roomCode ?? null,
        tenantName: c.room?.currentTenant?.name ?? null,
        status: c.status,
        deposit: c.deposit,
        notes: c.notes,
      }))
    ),
    utilities: serialize(
      utilities.map((u) => ({
        id: u.id,
        utilityType: u.utilityType,
        provider: u.provider,
        accountNo: u.accountNo,
        accountHolder: u.accountHolder,
        payTo: u.payTo,
        fixedAmount: u.fixedAmount,
        dueDay: u.dueDay,
        nextDue: u.dueDay ? nextDueDate(u.dueDay) : null,
        autoDebit: u.autoDebit,
        meterNo: u.meterNo,
        contractEnd: u.contractEnd,
        notes: u.notes,
      }))
    ),
    recentViews: views.map((v) => ({ at: v.timestamp.toISOString(), by: v.triggeredBy })),
  });
}

/** Partial update — only the fields sent are changed. */
export async function PUT(req: NextRequest, { params }: Ctx) {
  const auth = await requireUnitInfoAccess((await params).propertyCode);
  if (auth instanceof NextResponse) return auth;
  const { user, property } = auth;

  const body = await req.json().catch(() => null);
  const parsed = parseInfoUpdate(body?.fields);
  if ("error" in parsed) return NextResponse.json({ success: false, message: parsed.error }, { status: 400 });

  await prisma.propertyInfo.upsert({
    where: { propertyId: property.id },
    create: { propertyId: property.id, ...parsed.data, updatedBy: user.name },
    update: { ...parsed.data, updatedBy: user.name },
  });
  return NextResponse.json({ success: true, message: "✅ 已保存" });
}
