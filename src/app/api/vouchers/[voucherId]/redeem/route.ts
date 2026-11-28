import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { newId } from "@/lib/id";
import { allocateLumpSum, allocationMessage } from "@/lib/allocatePayment";
import { withActivity } from "@/lib/activity";

/** Redeem a voucher — the tenant it belongs to, or Admin on their behalf. This is the ONLY
 * point where a voucher touches money: spends exactly like cash against whatever the contract
 * currently owes (same allocation as a lump-sum payment or "一笔过收款"), with any leftover
 * banked as the contract's prepaid credit. Since no real cash funds this, it also books the
 * full voucher amount as a VOUCHER-category Expense against the room's property — right here,
 * at redemption, not when the voucher was issued, because a voucher that instead expires
 * unused never costs the company anything and should never have been booked at all. */
async function handlePOST(
  _req: NextRequest,
  { params }: { params: Promise<{ voucherId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ success: false, message: "请重新登录" }, { status: 401 });

  const { voucherId } = await params;
  const voucher = await prisma.voucher.findUnique({
    where: { id: voucherId },
    include: { contract: { include: { room: { include: { property: true } } } } },
  });
  if (!voucher) return NextResponse.json({ success: false, message: "找不到这张代金券" }, { status: 404 });

  const isOwnVoucher = voucher.tenantId === user.sub;
  if (!isOwnVoucher && user.role !== "ADMIN") {
    return NextResponse.json({ success: false, message: "没有权限兑换这张代金券" }, { status: 403 });
  }

  if (voucher.status !== "ISSUED") {
    return NextResponse.json(
      { success: false, message: voucher.status === "REDEEMED" ? "这张代金券已经兑换过了" : "这张代金券已经被取消了" },
      { status: 409 }
    );
  }
  if (voucher.expiryDate < new Date()) {
    return NextResponse.json({ success: false, message: "这张代金券已经过期了" }, { status: 409 });
  }
  if (!voucher.contract.room.propertyId || !voucher.contract.room.property) {
    return NextResponse.json({ success: false, message: "这间房没有关联楼盘，没办法登记代金券支出" }, { status: 409 });
  }

  const paidDateValue = new Date();
  const method = `代金券 Voucher (${voucher.voucherCode}: ${voucher.reason})`;
  const adHocNotes = `代金券兑换: ${voucher.voucherCode} (${voucher.reason})`;

  const result = await allocateLumpSum({
    contract: voucher.contract,
    amount: Number(voucher.amount),
    paidDateValue,
    method,
    receiptUrl: null,
    recordedByName: isOwnVoucher ? voucher.tenantName : user.name,
    reviewerName: user.name,
    adHocNotesSingle: adHocNotes,
    adHocNotesMultiple: adHocNotes,
    creditNotes: `预收余额 (代金券兑换: ${voucher.voucherCode})`,
  });

  const expenseCode = await newId("EX");
  const now = new Date();
  await prisma.expense.create({
    data: {
      expenseCode,
      propertyId: voucher.contract.room.propertyId,
      category: "VOUCHER",
      customLabel: voucher.reason,
      amount: Number(voucher.amount),
      periodMonth: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
      expenseDate: now,
      notes: `代金券兑换 (${voucher.voucherCode}, 合同 ${voucher.contract.contractCode}, 租客 ${voucher.tenantName})`,
      recordedBy: isOwnVoucher ? `${voucher.tenantName} (自己兑换)` : user.name,
    },
  });

  await prisma.voucher.update({
    where: { id: voucher.id },
    data: { status: "REDEEMED", redeemedAt: now },
  });

  return NextResponse.json({
    success: true,
    message: `✅ 代金券已兑换: RM${Number(voucher.amount).toFixed(2)} | ${allocationMessage(result)}`,
  });
}

export const POST = withActivity(handlePOST);
