import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { paymentTypeLabel, expenseCategoryLabel } from "@/lib/config";

const DEPOSIT_TYPES = ["DEPOSIT", "UTILITIES", "ACCESS_CARD"] as const;

function sum(nums: (number | null | undefined)[]) {
  return nums.reduce<number>((s, n) => s + (n ?? 0), 0);
}

/**
 * Company-wide cash flow + deposit position, for Boss/Admin.
 *
 * Two independent halves, deliberately kept apart instead of netted into one "profit" figure:
 *  - cashFlow: actual money that moved in/out in the selected period, from real transaction
 *    records only (Payment.paidDate, Contract.commPaidAt, MaintenanceRequest.costPaidAt).
 *  - obligations: recurring commitments computed from Property's static fields (fixed owner
 *    rent, management-fee split) — these are NOT verified-paid transactions, just what's owed
 *    right now / for the period, so they're reported separately and clearly labeled.
 *  - deposits: a balance-sheet snapshot as of now (deposits aren't a period flow) — tenant
 *    deposits currently held (liability) vs forfeited, and owner deposits paid out (asset).
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "BOSS" && user.role !== "ADMIN")) {
    return NextResponse.json({ success: false, message: "没有权限" }, { status: 403 });
  }

  const period = req.nextUrl.searchParams.get("period") || "month";
  const now = new Date();
  let rangeStart: Date | null = null;
  let rangeEnd: Date | null = null;
  let month = "";
  let year = now.getFullYear();
  let monthsInRange = 1;

  if (period === "month") {
    month = req.nextUrl.searchParams.get("month") || now.toISOString().slice(0, 7);
    const m = /^(\d{4})-(\d{2})$/.exec(month);
    if (!m) return NextResponse.json({ success: false, message: "月份格式不对, 要 YYYY-MM" }, { status: 400 });
    rangeStart = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1));
    rangeEnd = new Date(Date.UTC(Number(m[1]), Number(m[2]), 1));
    monthsInRange = 1;
  } else if (period === "year") {
    year = Number(req.nextUrl.searchParams.get("year")) || now.getFullYear();
    rangeStart = new Date(Date.UTC(year, 0, 1));
    rangeEnd = new Date(Date.UTC(year + 1, 0, 1));
    // A part-elapsed current year only "owes" up to the current month, not all 12 — avoids
    // overstating the owner-rent obligation for months that haven't happened yet.
    monthsInRange = year === now.getFullYear() ? now.getMonth() + 1 : 12;
  } else if (period !== "all") {
    return NextResponse.json({ success: false, message: "period 要是 month / year / all" }, { status: 400 });
  }

  const [payments, rooms, properties, paidCommissions, paidMaintenance, expenses] = await Promise.all([
    prisma.payment.findMany({
      where: { status: "Paid", ...(rangeStart && rangeEnd ? { paidDate: { gte: rangeStart, lt: rangeEnd } } : {}) },
      select: {
        type: true,
        amountPaid: true,
        roomCode: true,
        paidDate: true,
        method: true,
        customLabel: true,
        periodMonth: true,
        contract: {
          select: {
            contractCode: true,
            tenantName: true,
            room: { select: { isCarpark: true } },
            carparkRoom: { select: { roomCode: true } },
          },
        },
      },
      orderBy: { paidDate: "asc" },
    }),
    prisma.room.findMany({ select: { roomCode: true, propertyId: true, propertyName: true } }),
    prisma.property.findMany({
      select: {
        id: true,
        propertyCode: true,
        name: true,
        landlord: true,
        managementFeeRate: true,
        ownerRentalAmount: true,
        ownerDeposit: true,
      },
    }),
    prisma.contract.findMany({
      where: {
        commStatus: "Paid",
        commAmount: { not: null },
        ...(rangeStart && rangeEnd ? { commPaidAt: { gte: rangeStart, lt: rangeEnd } } : { commPaidAt: { not: null } }),
      },
      select: { commAmount: true },
    }),
    prisma.maintenanceRequest.findMany({
      where: {
        cost: { not: null },
        ...(rangeStart && rangeEnd ? { costPaidAt: { gte: rangeStart, lt: rangeEnd } } : { costPaidAt: { not: null } }),
      },
      select: { cost: true },
    }),
    prisma.expense.findMany({
      where: rangeStart && rangeEnd ? { expenseDate: { gte: rangeStart, lt: rangeEnd } } : {},
      select: {
        expenseCode: true,
        category: true,
        customLabel: true,
        amount: true,
        expenseDate: true,
        notes: true,
        property: { select: { propertyCode: true, name: true } },
      },
      orderBy: { expenseDate: "asc" },
    }),
  ]);

  const roomToProperty = new Map(rooms.map((r) => [r.roomCode, r.propertyId]));

  // --- Income transaction list (for reconciling against the bank statement line by line) ----
  const transactions = payments.map((p) => {
    const isCarpark = p.contract.room.isCarpark;
    return {
      paidDate: p.paidDate,
      roomCode: isCarpark ? null : p.roomCode,
      carparkCode: isCarpark ? p.roomCode : (p.contract.carparkRoom?.roomCode ?? null),
      contractCode: p.contract.contractCode,
      tenantName: p.contract.tenantName,
      type: p.type,
      typeLabel: paymentTypeLabel(p.type, p.customLabel),
      periodMonth: p.periodMonth,
      amount: Number(p.amountPaid),
      method: p.method,
    };
  });

  // --- Income (actual, this period) ---------------------------------------------------------
  let rentalIncome = 0;
  let depositIncome = 0;
  let otherIncome = 0;
  for (const p of payments) {
    const amt = Number(p.amountPaid);
    if (p.type === "RENTAL") rentalIncome += amt;
    else if ((DEPOSIT_TYPES as readonly string[]).includes(p.type)) depositIncome += amt;
    else otherIncome += amt;
  }
  const totalIncome = rentalIncome + depositIncome + otherIncome;

  // --- Actual outflow (verified-paid transactions only) -------------------------------------
  const commissionPaid = sum(paidCommissions.map((c) => Number(c.commAmount)));
  const maintenancePaid = sum(paidMaintenance.map((m) => Number(m.cost)));
  const expensePaid = sum(expenses.map((e) => Number(e.amount)));
  const totalActualOutflow = commissionPaid + maintenancePaid + expensePaid;

  const expenseTransactions = expenses.map((e) => ({
    expenseDate: e.expenseDate,
    propertyCode: e.property.propertyCode,
    propertyName: e.property.name,
    category: e.category,
    label: expenseCategoryLabel(e.category, e.customLabel),
    amount: Number(e.amount),
    notes: e.notes,
  }));

  const netCashFlow = totalIncome - totalActualOutflow;

  // --- Recurring obligations (computed from Property's static fields, not a paid-transaction
  // record — reported separately so it's never confused with verified cash movement) --------
  const collectedByProperty = new Map<string, number>();
  for (const p of payments) {
    const propertyId = roomToProperty.get(p.roomCode);
    if (!propertyId) continue;
    collectedByProperty.set(propertyId, (collectedByProperty.get(propertyId) ?? 0) + Number(p.amountPaid));
  }

  let ownerRentalMonthlyTotal = 0;
  let landlordPayoutPeriod = 0;
  const masterLeaseProperties: { propertyCode: string; name: string; landlord: string | null; ownerRentalAmount: number; ownerDeposit: number | null }[] = [];
  const managedProperties: { propertyCode: string; name: string; landlord: string | null; feeRate: number; collected: number; payout: number }[] = [];

  for (const prop of properties) {
    if (prop.ownerRentalAmount !== null) {
      const amt = Number(prop.ownerRentalAmount);
      ownerRentalMonthlyTotal += amt;
      masterLeaseProperties.push({
        propertyCode: prop.propertyCode,
        name: prop.name,
        landlord: prop.landlord,
        ownerRentalAmount: amt,
        ownerDeposit: prop.ownerDeposit !== null ? Number(prop.ownerDeposit) : null,
      });
    } else if (prop.managementFeeRate !== null) {
      const collected = collectedByProperty.get(prop.id) ?? 0;
      const feeRate = Number(prop.managementFeeRate);
      const payout = collected * (1 - feeRate);
      landlordPayoutPeriod += payout;
      managedProperties.push({
        propertyCode: prop.propertyCode,
        name: prop.name,
        landlord: prop.landlord,
        feeRate,
        collected,
        payout,
      });
    }
  }
  const ownerRentalObligation = ownerRentalMonthlyTotal * monthsInRange;
  const totalObligations = ownerRentalObligation + landlordPayoutPeriod;

  // --- Deposits (balance-sheet snapshot, as of now — not period-scoped) ---------------------
  const depositPayments = await prisma.payment.findMany({
    where: { status: "Paid", type: { in: [...DEPOSIT_TYPES] } },
    select: {
      type: true,
      amountPaid: true,
      roomCode: true,
      contract: { select: { status: true, contractCode: true, tenantName: true } },
    },
  });

  const propertyNameByRoom = new Map(rooms.map((r) => [r.roomCode, r.propertyName]));

  const tenantByType: Record<string, { held: number; forfeited: number }> = {
    DEPOSIT: { held: 0, forfeited: 0 },
    UTILITIES: { held: 0, forfeited: 0 },
    ACCESS_CARD: { held: 0, forfeited: 0 },
  };
  const heldByPropertyMap = new Map<string, number>();
  const heldContracts = new Set<string>();
  const forfeitedContracts = new Set<string>();

  for (const p of depositPayments) {
    const amt = Number(p.amountPaid);
    const forfeited = p.contract.status === "TERMINATED";
    tenantByType[p.type][forfeited ? "forfeited" : "held"] += amt;
    if (forfeited) forfeitedContracts.add(p.contract.contractCode);
    else {
      heldContracts.add(p.contract.contractCode);
      const propName = propertyNameByRoom.get(p.roomCode) ?? "其他";
      heldByPropertyMap.set(propName, (heldByPropertyMap.get(propName) ?? 0) + amt);
    }
  }
  const totalHeld = sum(Object.values(tenantByType).map((t) => t.held));
  const totalForfeited = sum(Object.values(tenantByType).map((t) => t.forfeited));
  const heldByProperty = Array.from(heldByPropertyMap.entries())
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount);

  const totalOwnerDeposit = sum(masterLeaseProperties.map((p) => p.ownerDeposit));

  return NextResponse.json({
    success: true,
    period,
    month,
    year,
    cashFlow: {
      income: { rental: rentalIncome, deposits: depositIncome, other: otherIncome, total: totalIncome },
      outflow: { commissionPaid, maintenancePaid, expensePaid, total: totalActualOutflow },
      netCashFlow,
      transactions,
      expenseTransactions,
    },
    obligations: {
      monthsInRange,
      ownerRentalMonthlyTotal,
      ownerRentalObligation,
      landlordPayoutPeriod,
      total: totalObligations,
      masterLeaseProperties,
      managedProperties,
    },
    deposits: {
      tenant: {
        byType: tenantByType,
        totalHeld,
        totalForfeited,
        heldContractCount: heldContracts.size,
        forfeitedContractCount: forfeitedContracts.size,
        byProperty: heldByProperty,
      },
      owner: {
        total: totalOwnerDeposit,
        properties: masterLeaseProperties,
      },
      netExposure: totalOwnerDeposit - totalHeld,
    },
  });
}
