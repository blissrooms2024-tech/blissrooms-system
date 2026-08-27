import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { newId } from "@/lib/id";
import { FEES, PAYMENT_TYPE_LABELS, RENT_ARREARS } from "@/lib/config";
import { notifyTenantLateFee, sendWarningLetter, notifyAdminsRentEscalation } from "@/lib/mail";

/** Vercel Cron hits this daily. Any bill (RENTAL/UTILITIES/AC/DRYER) still PENDING past its
 * dueDate gets a RM30 LATE_FEE bill charged for that day — idempotent per bill per day, so
 * re-running (or a bill staying overdue for a week) charges once per calendar day, not once
 * total. Excludes LATE_FEE rows themselves so penalties don't compound into penalties on
 * penalties. On top of that, overdue RENTAL bills specifically escalate: day 7 auto-sends the
 * tenant a warning letter, day 10 emails every Admin that the contract needs a manual decision
 * on termination + deposit forfeiture (never auto-executed). */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ success: false, message: "unauthorized" }, { status: 401 });
  }

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);

  const overdue = await prisma.payment.findMany({
    where: { status: "PENDING", dueDate: { lt: startOfToday }, type: { not: "LATE_FEE" } },
  });

  let charged = 0;
  let warned = 0;
  let escalated = 0;
  for (const bill of overdue) {
    const daysOverdue = Math.round((startOfToday.getTime() - bill.dueDate!.getTime()) / (24 * 3600 * 1000));

    const alreadyChargedToday = await prisma.payment.findFirst({
      where: { relatedPaymentId: bill.id, dueDate: { gte: startOfToday, lt: startOfTomorrow } },
    });
    if (!alreadyChargedToday) {
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

    if (bill.type !== "RENTAL") continue;

    if (daysOverdue === RENT_ARREARS.WARNING_LETTER_DAYS) {
      const alreadyWarned = await prisma.warningLetter.findFirst({
        where: { contractId: bill.contractId, triggeredBy: "system-cron", createdAt: { gte: bill.dueDate! } },
      });
      if (!alreadyWarned && bill.tenantId) {
        const [tenant, contract] = await Promise.all([
          prisma.user.findUnique({ where: { id: bill.tenantId } }),
          prisma.contract.findUnique({ where: { id: bill.contractId } }),
        ]);
        if (tenant && contract) {
          const message = `Your rent of RM${Number(bill.amountDue)} (${bill.periodMonth ?? ""}) is now ${daysOverdue} days overdue, and a late payment penalty of RM${FEES.LATE_PER_DAY}/day is accruing. Please upload payment slips for the rent and penalty as soon as possible, or we will proceed further under the terms of the contract, including termination.`;
          await sendWarningLetter(tenant, contract.contractCode, message, "system");
          await prisma.warningLetter.create({
            data: {
              letterCode: await newId("WL"),
              contractId: bill.contractId,
              message,
              sentBy: "System (Cron)",
              triggeredBy: "system-cron",
            },
          });
          warned++;
        }
      }
    }

    if (daysOverdue >= RENT_ARREARS.ESCALATION_DAYS) {
      const alreadyEscalated = await prisma.log.findFirst({
        where: { type: "RentEscalation", relatedId: bill.paymentCode },
      });
      if (!alreadyEscalated) {
        const contract = await prisma.contract.findUnique({ where: { id: bill.contractId } });
        if (contract) {
          await notifyAdminsRentEscalation(
            { paymentCode: bill.paymentCode, contractCode: contract.contractCode, roomCode: bill.roomCode, type: bill.type, amountDue: Number(bill.amountDue), amountPaid: Number(bill.amountPaid) },
            contract.contractCode,
            bill.tenantName ?? contract.tenantName,
            daysOverdue
          );
          escalated++;
        }
      }
    }
  }

  return NextResponse.json({ success: true, charged, warned, escalated });
}
