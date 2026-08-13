import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { newId } from "@/lib/id";
import { FEES, PAYMENT_TYPE_LABELS } from "@/lib/config";
import { notifyTenantLateFee } from "@/lib/mail";

/** Vercel Cron hits this daily. Any bill (RENTAL/UTILITIES/AC/DRYER) still PENDING past its
 * dueDate gets a RM30 LATE_FEE bill charged for that day — idempotent per bill per day, so
 * re-running (or a bill staying overdue for a week) charges once per calendar day, not once total. */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ success: false, message: "unauthorized" }, { status: 401 });
  }

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);

  const overdue = await prisma.payment.findMany({
    where: { status: "PENDING", dueDate: { lt: startOfToday } },
  });

  let charged = 0;
  for (const bill of overdue) {
    const alreadyChargedToday = await prisma.payment.findFirst({
      where: { relatedPaymentId: bill.id, dueDate: { gte: startOfToday, lt: startOfTomorrow } },
    });
    if (alreadyChargedToday) continue;

    const lateFeeCode = await newId("PY");
    await prisma.payment.create({
      data: {
        paymentCode: lateFeeCode,
        contractId: bill.contractId,
        roomCode: bill.roomCode,
        tenantId: bill.tenantId,
        tenantName: bill.tenantName,
        periodMonth: bill.periodMonth,
        type: "LATE_FEE",
        amountDue: FEES.LATE_PER_DAY,
        amountPaid: 0,
        dueDate: startOfToday,
        status: "PENDING",
        relatedPaymentId: bill.id,
        recordedBy: "System (Cron)",
        notes: `迟交罚款 - 账单 ${bill.paymentCode} (${PAYMENT_TYPE_LABELS[bill.type] ?? bill.type}${bill.periodMonth ? " " + bill.periodMonth : ""})`,
      },
    });

    if (bill.tenantId) {
      const tenant = await prisma.user.findUnique({ where: { id: bill.tenantId } });
      if (tenant) {
        await notifyTenantLateFee(
          tenant,
          {
            paymentCode: lateFeeCode,
            contractCode: "",
            roomCode: bill.roomCode,
            type: "LATE_FEE",
            amountDue: FEES.LATE_PER_DAY,
            amountPaid: 0,
          },
          bill.type
        );
      }
    }
    charged++;
  }

  return NextResponse.json({ success: true, charged });
}
