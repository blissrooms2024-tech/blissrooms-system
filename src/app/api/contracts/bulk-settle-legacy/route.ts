import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { newId } from "@/lib/id";

const SETTLE_TYPES = ["DEPOSIT", "UTILITIES", "ADMIN_FEE", "ACCESS_CARD", "RENTAL", "CARPARK"] as const;

/** One-off catch-up for legacy contracts imported before the importer started auto-marking
 * deposit/admin fee/first month's rent as Paid — those rows are still sitting there showing
 * the full amount as outstanding even though the tenant settled it long ago. Safe to re-run:
 * each item's still-open amount is computed the same way the 费用明细 breakdown does (due minus
 * whatever's already status=Paid), so an item that's already been fixed contributes 0 and
 * nothing is double-created. Only touches legacy contracts (ACTIVE, never digitally signed by
 * either side) — a real new contract's deposit stays genuinely collectible. */
export async function POST() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ success: false, message: "只有 Admin 可以执行这个操作" }, { status: 403 });
  }

  const contracts = await prisma.contract.findMany({
    where: { status: "ACTIVE", agentSignature: null, tenantSignature: null },
    include: { room: { select: { roomCode: true } } },
  });

  let contractsFixed = 0;
  let paymentsCreated = 0;
  const details: string[] = [];

  for (const c of contracts) {
    const due: Record<string, number> = {
      DEPOSIT: Number(c.securityDeposit),
      UTILITIES: Number(c.utilitiesDeposit),
      ADMIN_FEE: Number(c.adminFee),
      ACCESS_CARD: Number(c.accessCardDeposit),
      RENTAL: Number(c.roomRental),
      CARPARK: Number(c.carparkRental),
    };

    const existing = await prisma.payment.findMany({ where: { contractId: c.id, status: "Paid" } });
    const paidByType: Record<string, number> = {};
    for (const p of existing) {
      paidByType[p.type] = (paidByType[p.type] || 0) + Number(p.amountPaid);
    }

    const toSettle = SETTLE_TYPES.map((type) => ({
      type,
      amount: Math.max((due[type] || 0) - (paidByType[type] || 0), 0),
    })).filter((it) => it.amount > 0);

    if (toSettle.length === 0) continue;

    const settledDate = c.moveInDate ?? c.commencementDate ?? c.createdAt;
    for (const it of toSettle) {
      await prisma.payment.create({
        data: {
          paymentCode: await newId("PY"),
          contractId: c.id,
          roomCode: c.room.roomCode,
          tenantId: c.tenantId,
          tenantName: c.tenantName,
          type: it.type,
          amountDue: it.amount,
          amountPaid: it.amount,
          paidDate: settledDate,
          status: "Paid",
          notes: "旧合同补记 (入住前已收齐，日期为占位，待 Admin 核实)",
          recordedBy: user.name,
        },
      });
      paymentsCreated++;
    }
    contractsFixed++;
    details.push(`${c.contractCode} (${c.tenantName}): ${toSettle.map((it) => `${it.type} RM${it.amount}`).join(", ")}`);
  }

  return NextResponse.json({
    success: true,
    message:
      contractsFixed > 0
        ? `✅ 已补齐 ${contractsFixed} 张旧合同, 共 ${paymentsCreated} 笔记录`
        : "没有需要补齐的旧合同, 全部都已经是最新的",
    contractsFixed,
    paymentsCreated,
    details,
  });
}
