import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { newId } from "@/lib/id";
import { serialize } from "@/lib/serialize";

/** Property running costs — water/electric/wifi/cleaning/maintenance/other, booked to a
 * periodMonth so the property monthly report can deduct them from net profit / landlord
 * payout, and the company-wide finance overview can fold them into actual cash outflow. */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "BOSS" && user.role !== "ADMIN")) {
    return NextResponse.json({ success: false, message: "没有权限" }, { status: 403 });
  }

  const propertyCode = req.nextUrl.searchParams.get("propertyCode");
  const month = req.nextUrl.searchParams.get("month");

  const property = propertyCode ? await prisma.property.findUnique({ where: { propertyCode } }) : null;
  if (propertyCode && !property) return NextResponse.json({ success: false, message: "找不到这个楼盘" }, { status: 404 });

  const expenses = await prisma.expense.findMany({
    where: {
      ...(property ? { propertyId: property.id } : {}),
      ...(month ? { periodMonth: month } : {}),
    },
    orderBy: [{ expenseDate: "desc" }],
    include: { property: { select: { propertyCode: true, name: true } } },
  });

  return NextResponse.json({ success: true, expenses: serialize(expenses) });
}

const schema = z.object({
  propertyCode: z.string().trim().min(1),
  category: z.enum(["WATER", "ELECTRIC", "WIFI", "CLEANING", "MAINTENANCE", "OTHER"]),
  customLabel: z.string().trim().optional().default(""),
  amount: z.coerce.number().positive(),
  periodMonth: z.string().regex(/^\d{4}-\d{2}$/),
  expenseDate: z.coerce.date(),
  notes: z.string().trim().optional().default(""),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ success: false, message: "只有 Admin 可以登记支出" }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "资料格式不对" }, { status: 400 });
  }
  const d = parsed.data;
  if (d.category === "OTHER" && !d.customLabel) {
    return NextResponse.json({ success: false, message: "「其他」类型要填支出名称" }, { status: 400 });
  }

  const property = await prisma.property.findUnique({ where: { propertyCode: d.propertyCode } });
  if (!property) return NextResponse.json({ success: false, message: "找不到这个楼盘" }, { status: 404 });

  const expenseCode = await newId("EX");
  await prisma.expense.create({
    data: {
      expenseCode,
      propertyId: property.id,
      category: d.category,
      customLabel: d.customLabel || null,
      amount: d.amount,
      periodMonth: d.periodMonth,
      expenseDate: d.expenseDate,
      notes: d.notes || null,
      recordedBy: user.name,
    },
  });

  return NextResponse.json({ success: true, message: `✅ 支出已登记: ${expenseCode}` });
}
