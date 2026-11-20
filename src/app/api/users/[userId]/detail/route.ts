import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { serialize } from "@/lib/serialize";

/** Admin/Boss drill-down into one user's full history — for a TENANT: every contract they're
 * on with its outstanding, every fee/deposit/rental bill ever issued to them, and every
 * maintenance report they've filed; for an AGENT: every contract they're handling (which
 * room/unit, which tenant) and their commission totals. Reuses the same "true outstanding"
 * calculation as the Contracts list (unbilled move-in remainder + every open bill), not the
 * stale move-in-only totalOutstanding. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const admin = await getCurrentUser();
  if (!admin || (admin.role !== "ADMIN" && admin.role !== "BOSS")) {
    return NextResponse.json({ success: false, message: "没有权限查看" }, { status: 403 });
  }

  const { userId } = await params;
  const u = await prisma.user.findUnique({ where: { userCode: userId } });
  if (!u) return NextResponse.json({ success: false, message: "找不到用户" }, { status: 404 });

  const user = {
    userCode: u.userCode,
    name: u.name,
    email: u.email,
    role: u.role,
    phone: u.phone,
    ic: u.ic,
    status: u.status,
    verified: u.verified,
    bankName: u.bankName,
    bankAccountName: u.bankAccountName,
    bankAccountNumber: u.bankAccountNumber,
    commRate: u.commRate ? Number(u.commRate) : null,
    createdAt: u.createdAt,
  };

  if (u.role === "TENANT" || u.role === "AGENT") {
    // An Agent can also be the tenant on their own contract, so both relations are checked
    // regardless of role — whichever is non-empty drives which section(s) render.
    const [tenantContracts, agentContracts] = await Promise.all([
      prisma.contract.findMany({
        where: { tenantId: u.id },
        orderBy: { createdAt: "desc" },
        include: { room: { select: { roomCode: true } } },
      }),
      prisma.contract.findMany({
        where: { agentId: u.id },
        orderBy: { createdAt: "desc" },
        include: { room: { select: { roomCode: true } } },
      }),
    ]);

    const tenantContractIds = tenantContracts.map((c) => c.id);
    const [allPayments, maintenanceRequests] = await Promise.all([
      prisma.payment.findMany({
        where: { contractId: { in: tenantContractIds } },
        orderBy: { id: "desc" },
      }),
      prisma.maintenanceRequest.findMany({
        where: { tenantId: u.id },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const paymentsByContract = new Map<string, typeof allPayments>();
    for (const p of allPayments) {
      const arr = paymentsByContract.get(p.contractId);
      if (arr) arr.push(p);
      else paymentsByContract.set(p.contractId, [p]);
    }

    const contracts = tenantContracts.map((c) => {
      const cp = paymentsByContract.get(c.id) ?? [];
      const billedByType: Record<string, number> = {};
      const paidByType: Record<string, number> = {};
      for (const p of cp) {
        billedByType[p.type] = (billedByType[p.type] || 0) + Number(p.amountDue);
        if (p.status === "Paid") paidByType[p.type] = (paidByType[p.type] || 0) + Number(p.amountPaid);
      }
      // Whichever is larger of the contract's own reference rate and everything ever actually
      // billed — same as the Contracts list and per-contract breakdown, so this total always
      // equals paid + outstanding instead of silently drifting from them (c.totalOutstanding is
      // a static move-in-time snapshot that never grows as later recurring bills get issued).
      const due: Record<string, number> = {
        DEPOSIT: Math.max(Number(c.securityDeposit), billedByType.DEPOSIT || 0),
        UTILITIES: Math.max(Number(c.utilitiesDeposit), billedByType.UTILITIES || 0),
        ADMIN_FEE: Math.max(Number(c.adminFee), billedByType.ADMIN_FEE || 0),
        ACCESS_CARD: Math.max(Number(c.accessCardDeposit), billedByType.ACCESS_CARD || 0),
        CARPARK: Math.max(Number(c.carparkRental), billedByType.CARPARK || 0),
        RENTAL: Math.max(Number(c.roomRental), billedByType.RENTAL || 0),
      };
      const openBillTypes = new Set<string>(cp.filter((p) => p.status === "PENDING" || p.status === "REJECTED").map((p) => p.type));
      const unbilledBreakdownTotal = Object.entries(due)
        .filter(([type]) => !openBillTypes.has(type))
        .reduce((s, [type, dd]) => s + Math.max(dd - (paidByType[type] || 0), 0), 0);
      const openBillsTotal = cp
        .filter((p) => p.status === "PENDING" || p.status === "REJECTED")
        .reduce((s, p) => s + Number(p.amountDue), 0);
      const paid = cp.filter((p) => p.status === "Paid").reduce((s, p) => s + Number(p.amountPaid), 0);

      return {
        contractCode: c.contractCode,
        roomCode: c.room.roomCode,
        status: c.status,
        expiredDate: c.expiredDate,
        totalOutstanding: Object.values(due).reduce((s, dd) => s + dd, 0),
        paid,
        outstanding: unbilledBreakdownTotal + openBillsTotal,
      };
    });

    const payments = allPayments.map((p) => ({
      paymentCode: p.paymentCode,
      contractCode: tenantContracts.find((c) => c.id === p.contractId)?.contractCode ?? "",
      roomCode: p.roomCode,
      type: p.type,
      customLabel: p.customLabel,
      amountDue: Number(p.amountDue),
      amountPaid: Number(p.amountPaid),
      status: p.status,
      periodMonth: p.periodMonth,
      dueDate: p.dueDate,
      paidDate: p.paidDate,
    }));

    const agentContractsOut = agentContracts.map((c) => ({
      contractCode: c.contractCode,
      roomCode: c.room.roomCode,
      tenantName: c.tenantName,
      status: c.status,
      commAmount: c.commAmount !== null ? Number(c.commAmount) : null,
      commStatus: c.commAmount !== null ? c.commStatus : null,
    }));
    const commissionPaid = agentContractsOut
      .filter((c) => c.commStatus === "Paid")
      .reduce((s, c) => s + (c.commAmount ?? 0), 0);
    const commissionPending = agentContractsOut
      .filter((c) => c.commAmount !== null && c.commStatus !== "Paid")
      .reduce((s, c) => s + (c.commAmount ?? 0), 0);

    return NextResponse.json({
      success: true,
      user,
      contracts: serialize(contracts),
      payments: serialize(payments),
      maintenanceRequests: serialize(maintenanceRequests),
      agentContracts: serialize(agentContractsOut),
      agentStats: {
        tenantCount: new Set(agentContracts.map((c) => c.tenantId).filter(Boolean)).size,
        roomCount: new Set(agentContracts.map((c) => c.room.roomCode)).size,
        commissionPaid,
        commissionPending,
      },
    });
  }

  return NextResponse.json({ success: true, user, contracts: [], payments: [], maintenanceRequests: [], agentContracts: [], agentStats: null });
}
