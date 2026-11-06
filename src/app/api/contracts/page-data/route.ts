import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { serialize } from "@/lib/serialize";
import { RENT_ARREARS, RULES } from "@/lib/config";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ success: false, message: "请重新登录" }, { status: 401 });
  if (!["BOSS", "ADMIN", "AGENT"].includes(user.role)) {
    return NextResponse.json({ success: false, message: "没有权限" }, { status: 403 });
  }

  const where = user.role === "AGENT" ? { agentId: user.sub } : {};

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const escalationCutoff = new Date(startOfToday.getTime() - RENT_ARREARS.ESCALATION_DAYS * 24 * 3600 * 1000);
  const expiringSoonCutoff = new Date(startOfToday);
  expiringSoonCutoff.setMonth(expiringSoonCutoff.getMonth() + RULES.NOTICE_MONTHS);

  try {
    const [contracts, allPayments, vacantRooms, agents, escalatedRentBills] = await Promise.all([
      prisma.contract.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: { room: { select: { roomCode: true } } },
      }),
      prisma.payment.findMany({
        select: { contractId: true, type: true, status: true, amountDue: true, amountPaid: true },
      }),
      prisma.room.findMany({
        where: { status: "VACANT" },
        select: { roomCode: true, propertyName: true, isCarpark: true },
      }),
      user.role === "ADMIN"
        ? prisma.user.findMany({
            where: { role: "AGENT", status: "ACTIVE" },
            select: { userCode: true, name: true },
            orderBy: { name: "asc" },
          })
        : Promise.resolve([]),
      prisma.payment.findMany({
        where: { type: "RENTAL", status: "PENDING", dueDate: { lte: escalationCutoff } },
        select: { contractId: true },
      }),
    ]);

    const paymentsByContract = new Map<string, typeof allPayments>();
    for (const p of allPayments) {
      const arr = paymentsByContract.get(p.contractId);
      if (arr) arr.push(p);
      else paymentsByContract.set(p.contractId, [p]);
    }
    const escalatedSet = new Set(escalatedRentBills.map((b) => b.contractId));
    const list = contracts.map((c) => {
      const contractPayments = paymentsByContract.get(c.id) ?? [];
      const paid = contractPayments
        .filter((p) => p.status === "Paid")
        .reduce((s, p) => s + Number(p.amountPaid), 0);

      // Mirrors /api/contracts/[contractId]/payments's "Owing" fix: the move-in totalOutstanding
      // never grows as later recurring bills (rent/carpark/utilities for new months) get issued,
      // so it alone can't tell us what's really still owed. It's the still-unbilled remainder of
      // the move-in breakdown (skipping any item that already has its own open bill, to avoid
      // double-counting) plus every currently open (PENDING/REJECTED) bill's amountDue.
      const due: Record<string, number> = {
        DEPOSIT: Number(c.securityDeposit),
        UTILITIES: Number(c.utilitiesDeposit),
        ADMIN_FEE: Number(c.adminFee),
        ACCESS_CARD: Number(c.accessCardDeposit),
        CARPARK: Number(c.carparkRental),
        RENTAL: Number(c.roomRental),
      };
      const paidByType: Record<string, number> = {};
      for (const p of contractPayments) {
        if (p.status !== "Paid") continue;
        paidByType[p.type] = (paidByType[p.type] || 0) + Number(p.amountPaid);
      }
      const openBillTypes = new Set<string>(
        contractPayments.filter((p) => p.status === "PENDING" || p.status === "REJECTED").map((p) => p.type)
      );
      const unbilledBreakdownTotal = Object.entries(due)
        .filter(([type]) => !openBillTypes.has(type))
        .reduce((s, [type, dd]) => s + Math.max(dd - (paidByType[type] || 0), 0), 0);
      const openBillsTotal = contractPayments
        .filter((p) => p.status === "PENDING" || p.status === "REJECTED")
        .reduce((s, p) => s + Number(p.amountDue), 0);
      const outstanding = unbilledBreakdownTotal + openBillsTotal;

      const expiringSoon =
        c.status === "ACTIVE" && !!c.expiredDate && c.expiredDate >= startOfToday && c.expiredDate <= expiringSoonCutoff;
      // Still marked ACTIVE but already past its own expiry date — nothing in this codebase
      // auto-flips status to EXPIRED, so this is the only reliable way to spot a lease that's
      // run out but hasn't been formally renewed/terminated/moved out yet.
      const expired = c.status === "ACTIVE" && !!c.expiredDate && c.expiredDate < startOfToday;
      return serialize({
        ...c,
        _paid: paid,
        _outstanding: outstanding,
        _rentEscalated: escalatedSet.has(c.id),
        _expiringSoon: expiringSoon,
        _expired: expired,
      });
    });

    return NextResponse.json({
      success: true,
      contracts: list,
      // "vacant" is every vacant room including carparks — a carpark can itself be the main
      // room on a carpark-only contract. "vacantCarparks" is only carparks, for the separate
      // optional carpark-add-on picker on a non-carpark contract.
      vacant: vacantRooms,
      vacantCarparks: vacantRooms.filter((r) => r.isCarpark),
      agents,
    });
  } catch (e) {
    console.error("[contracts/page-data]", e);
    return NextResponse.json(
      { success: false, message: "读取合同资料失败: " + (e instanceof Error ? e.message : String(e)) },
      { status: 500 }
    );
  }
}
