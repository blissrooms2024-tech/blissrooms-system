import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { serialize } from "@/lib/serialize";
import { RENT_ARREARS, RULES } from "@/lib/config";
import { computeBillBreakdown } from "@/lib/billBreakdown";

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
        include: { room: { select: { roomCode: true, isCarpark: true, property: { select: { propertyCode: true, name: true } } } } },
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
      // Single source of truth for 总款/已收/还欠 — shared with the per-contract Payments
      // breakdown, the Contract detail page, the lump-sum form and the user-detail drill-down,
      // so this list's figures can never again drift apart from what those other pages show.
      const { totalDue, totalPaid: paid, totalOutstanding: outstanding } = computeBillBreakdown(
        c,
        contractPayments,
        c.room.isCarpark
      );
      // Not a stored field — same live sum of CREDIT-type rows as the Payments modal's own
      // "预收余额" box, so a contract that's been overpaid (or given a voucher) shows that here
      // too instead of just looking like any other fully-settled contract.
      const creditBalance = contractPayments
        .filter((p) => p.type === "CREDIT" && p.status === "Paid")
        .reduce((s, p) => s + Number(p.amountPaid), 0);

      const expiringSoon =
        c.status === "ACTIVE" && !!c.expiredDate && c.expiredDate >= startOfToday && c.expiredDate <= expiringSoonCutoff;
      // Still marked ACTIVE but already past its own expiry date — nothing in this codebase
      // auto-flips status to EXPIRED, so this is the only reliable way to spot a lease that's
      // run out but hasn't been formally renewed/terminated/moved out yet.
      const expired = c.status === "ACTIVE" && !!c.expiredDate && c.expiredDate < startOfToday;
      return serialize({
        ...c,
        // Which unit it's in, flat, for the 楼盘 filter and the unit page's 合同 tab.
        room: { roomCode: c.room.roomCode, isCarpark: c.room.isCarpark, propertyCode: c.room.property?.propertyCode ?? null, propertyName: c.room.property?.name ?? null },
        _due: totalDue,
        _paid: paid,
        _outstanding: outstanding,
        _creditBalance: creditBalance,
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
