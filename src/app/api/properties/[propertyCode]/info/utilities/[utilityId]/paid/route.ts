import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { newId } from "@/lib/id";
import { withActivity } from "@/lib/activity";
import { requireUnitInfoAccess } from "@/lib/unitInfoServer";
import { addMonths, isPeriod, myDay, periodOf, utilityExpenseCategory } from "@/lib/bills";
import { UTILITY_TYPE_LABELS } from "@/lib/unitInfo";

const schema = z.object({
  period: z.string().refine(isPeriod, "月份格式不对"),
  /** Optional: also book the amount paid as an expense for this unit and month. */
  amount: z
    .union([z.number(), z.string(), z.null()])
    .optional()
    .transform((v) => (v === null || v === undefined || v === "" ? null : Number(v))),
  paidDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

/** Mark one billing month of a utility account as paid (clears its dashboard reminder). */
async function handlePOST(req: NextRequest, { params }: { params: Promise<{ propertyCode: string; utilityId: string }> }) {
  const { propertyCode, utilityId } = await params;
  const auth = await requireUnitInfoAccess(propertyCode);
  if (auth instanceof NextResponse) return auth;
  const { user, property } = auth;

  const acc = await prisma.utilityAccount.findUnique({ where: { id: utilityId } });
  if (!acc || acc.propertyId !== property.id) {
    return NextResponse.json({ success: false, message: "找不到这个账户" }, { status: 404 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, message: "资料格式不对" }, { status: 400 });
  const { period, amount, paidDate } = parsed.data;
  if (period > addMonths(periodOf(myDay()), 1)) {
    return NextResponse.json({ success: false, message: "不能标记太远的未来月份" }, { status: 400 });
  }
  if (amount !== null && (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000)) {
    return NextResponse.json({ success: false, message: "金额不对" }, { status: 400 });
  }

  let expenseCode: string | null = null;
  if (amount && amount > 0) {
    const { category, customLabel } = utilityExpenseCategory(acc.utilityType);
    expenseCode = await newId("EX");
    await prisma.expense.create({
      data: {
        expenseCode,
        propertyId: property.id,
        category,
        customLabel,
        amount: Math.round(amount * 100) / 100,
        periodMonth: period,
        expenseDate: paidDate ? new Date(`${paidDate}T00:00:00.000Z`) : myDay(),
        notes: `水电网账户 ${[acc.provider, acc.accountNo].filter(Boolean).join(" ")} · ${period}`,
        recordedBy: user.name,
      },
    });
  }

  const newPaid = acc.lastPaidPeriod && acc.lastPaidPeriod > period ? acc.lastPaidPeriod : period;
  await prisma.utilityAccount.update({ where: { id: acc.id }, data: { lastPaidPeriod: newPaid } });

  const label = (UTILITY_TYPE_LABELS[acc.utilityType]?.[0] ?? acc.utilityType).replace(/^\S+\s/, "");
  return NextResponse.json({
    success: true,
    message: `${property.propertyCode} ${label} ${period} 已标记已付${expenseCode ? `，已记入支出 ${expenseCode}（RM${amount!.toFixed(2)}）` : ""}`,
  });
}

export const POST = withActivity(handlePOST);
