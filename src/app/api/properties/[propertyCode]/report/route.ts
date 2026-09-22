import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { expenseCategoryLabel } from "@/lib/config";
import { serialize } from "@/lib/serialize";

/**
 * Monthly income report for a Unit (Property): total collected, broken down by room and by
 * payment type, running expenses (water/electric/wifi/cleaning/maintenance/other) booked to
 * this month, and — for units managed on behalf of a landlord, or master-leased from an
 * owner — the net amount payable/profit after Bliss Rooms' management fee (or fixed owner
 * rent) and those expenses.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ propertyCode: string }> }
) {
  const user = await getCurrentUser();
  if (!user || !["BOSS", "ADMIN", "AGENT"].includes(user.role)) {
    return NextResponse.json({ success: false, message: "没有权限" }, { status: 403 });
  }
  const { propertyCode } = await params;

  const monthParam = req.nextUrl.searchParams.get("month") || "";
  const m = /^(\d{4})-(\d{2})$/.exec(monthParam);
  if (!m) return NextResponse.json({ success: false, message: "月份格式不对, 要 YYYY-MM" }, { status: 400 });
  const year = Number(m[1]);
  const monthIdx = Number(m[2]) - 1;
  const rangeStart = new Date(Date.UTC(year, monthIdx, 1));
  const rangeEnd = new Date(Date.UTC(year, monthIdx + 1, 1));

  const property = await prisma.property.findUnique({
    where: { propertyCode },
    include: { rooms: { select: { roomCode: true, propertyName: true } } },
  });
  if (!property) return NextResponse.json({ success: false, message: "找不到这个楼盘" }, { status: 404 });

  const roomCodes = property.rooms.map((r) => r.roomCode);
  const [payments, expenses, maintenanceCosts] = await Promise.all([
    roomCodes.length
      ? prisma.payment.findMany({
          where: {
            roomCode: { in: roomCodes },
            paidDate: { gte: rangeStart, lt: rangeEnd },
            status: "Paid",
          },
          orderBy: [{ roomCode: "asc" }, { paidDate: "asc" }],
        })
      : Promise.resolve([]),
    prisma.expense.findMany({
      where: { propertyId: property.id, periodMonth: monthParam },
      orderBy: { expenseDate: "asc" },
    }),
    roomCodes.length
      ? prisma.maintenanceRequest.findMany({
          where: { roomCode: { in: roomCodes }, cost: { not: null }, costPaidAt: { gte: rangeStart, lt: rangeEnd } },
          select: { requestCode: true, roomCode: true, title: true, cost: true, costPaidAt: true },
        })
      : Promise.resolve([]),
  ]);

  const byRoom = new Map<
    string,
    { roomCode: string; tenantName: string | null; byType: Record<string, number>; total: number }
  >();
  for (const code of roomCodes) {
    byRoom.set(code, { roomCode: code, tenantName: null, byType: {}, total: 0 });
  }
  const byType: Record<string, number> = {};
  let total = 0;

  for (const p of payments) {
    const row = byRoom.get(p.roomCode);
    if (!row) continue;
    const amt = Number(p.amountPaid);
    row.byType[p.type] = (row.byType[p.type] || 0) + amt;
    row.total += amt;
    row.tenantName = p.tenantName ?? row.tenantName;
    byType[p.type] = (byType[p.type] || 0) + amt;
    total += amt;
  }

  const expenseItems = expenses.map((e) => ({
    expenseCode: e.expenseCode,
    category: e.category,
    label: expenseCategoryLabel(e.category, e.customLabel),
    amount: Number(e.amount),
    expenseDate: e.expenseDate,
    notes: e.notes,
    recordedBy: e.recordedBy,
  }));
  const expenseTotal = expenseItems.reduce((s, e) => s + e.amount, 0);
  const maintenanceItems = maintenanceCosts.map((m) => ({
    requestCode: m.requestCode,
    roomCode: m.roomCode,
    title: m.title,
    amount: Number(m.cost),
    costPaidAt: m.costPaidAt,
  }));
  const maintenanceTotal = maintenanceItems.reduce((s, m) => s + m.amount, 0);
  const totalExpenses = expenseTotal + maintenanceTotal;

  const feeRate = property.managementFeeRate ? Number(property.managementFeeRate) : 0;
  const managementFee = property.managementFeeRate ? total * feeRate : 0;
  const netToLandlord = property.managementFeeRate ? total - managementFee - totalExpenses : null;

  const ownerRentalAmount = property.ownerRentalAmount ? Number(property.ownerRentalAmount) : null;
  const netProfit = ownerRentalAmount !== null ? total - ownerRentalAmount - totalExpenses : null;

  return NextResponse.json({
    success: true,
    property: {
      propertyCode: property.propertyCode,
      name: property.name,
      address: property.address,
      landlord: property.landlord,
      managementFeeRate: property.managementFeeRate ? feeRate : null,
      ownerRentalAmount,
    },
    month: monthParam,
    rooms: Array.from(byRoom.values()),
    byType,
    total,
    expenses: serialize({ items: expenseItems, total: expenseTotal }),
    maintenance: serialize({ items: maintenanceItems, total: maintenanceTotal }),
    totalExpenses,
    managementFee,
    netToLandlord,
    netProfit,
  });
}
