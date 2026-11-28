import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, type SessionPayload } from "@/lib/auth/session";
import { serialize } from "@/lib/serialize";
import { contractEditSchema } from "@/lib/schemas/contract";
import { RENT_ARREARS } from "@/lib/config";
import { computeBillBreakdown } from "@/lib/billBreakdown";
import { newId } from "@/lib/id";
import { notifyTenantBillCreated } from "@/lib/mail";
import { withActivity } from "@/lib/activity";

const PRORATA_NOTE = "Pro-rata 租金 (提前入住)";

function canView(user: SessionPayload, contract: { agentId: string; tenantId: string | null }) {
  if (user.role === "BOSS" || user.role === "ADMIN") return true;
  if (user.role === "AGENT" && contract.agentId === user.sub) return true;
  // Not gated on role === "TENANT": an Agent can also be the tenant on their own contract.
  if (contract.tenantId === user.sub) return true;
  return false;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ contractId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ success: false, message: "请重新登录" }, { status: 401 });

  const { contractId } = await params;
  const contract = await prisma.contract.findUnique({
    where: { contractCode: contractId },
    include: { room: true, carparkRoom: { select: { roomCode: true, propertyName: true, carparkLotNumber: true } }, agent: { select: { ic: true } } },
  });
  if (!contract) return NextResponse.json({ success: false, message: "找不到合同" }, { status: 404 });
  if (!canView(user, contract)) {
    return NextResponse.json({ success: false, message: "没有权限查看这张合同" }, { status: 403 });
  }

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const escalationCutoff = new Date(startOfToday.getTime() - RENT_ARREARS.ESCALATION_DAYS * 24 * 3600 * 1000);

  const [payments, pendingReviewAgg, escalatedBill, moveInForm, signEvidence] = await Promise.all([
    prisma.payment.findMany({
      where: { contractId: contract.id },
      select: { type: true, amountDue: true, amountPaid: true, status: true },
    }),
    // Once a tenant has uploaded a slip, the ball is in Admin's court (the 交易单审核 queue) —
    // shown as a separate footnote so Admin knows some of "还欠" is already in review, without
    // folding it into 已收/还欠 themselves (those stay Paid-only, same definition as every other
    // page that shows a contract's totals).
    prisma.payment.aggregate({
      where: { contractId: contract.id, status: "PENDING_REVIEW" },
      _sum: { amountPaid: true },
    }),
    prisma.payment.findFirst({
      where: { contractId: contract.id, type: "RENTAL", status: "PENDING", dueDate: { lte: escalationCutoff } },
      select: { id: true },
    }),
    prisma.moveInOutForm.findFirst({
      where: { contractId: contract.id, type: "MOVE_IN" },
      select: { id: true },
    }),
    prisma.log.findFirst({
      where: { type: "TENANT_SIGN_EVIDENCE", relatedId: contract.contractCode },
      select: { timestamp: true },
    }),
  ]);
  const pendingReview = Number(pendingReviewAgg._sum.amountPaid ?? 0);
  // Single source of truth for 总款/已收/还欠 — shared with the Payments breakdown, the
  // Contracts list, the lump-sum form and the user-detail drill-down, so this page can never
  // again show a different "还欠" than those other pages do for the same contract (it used to:
  // this route alone still used the static move-in-time totalOutstanding snapshot).
  const { totalDue, totalPaid, totalOutstanding } = computeBillBreakdown(contract, payments, contract.room.isCarpark);

  const { agent, ...rest } = contract;
  return NextResponse.json({
    success: true,
    contract: serialize({
      ...rest,
      agentIc: agent.ic,
      _due: totalDue,
      _paid: totalPaid,
      _pendingReview: pendingReview,
      _outstanding: totalOutstanding,
      _rentEscalated: !!escalatedBill,
      _moveInDone: !!moveInForm,
      // Same rule as the Contracts list's "⛔ 已过期" badge — an ACTIVE contract past its own
      // expiredDate with no renewal yet, so the status badge here doesn't keep saying "生效中"
      // once the lease term is actually over.
      _expired: contract.status === "ACTIVE" && !!contract.expiredDate && contract.expiredDate < startOfToday,
      // Legacy-imported contracts go straight to ACTIVE with no digital signature on either
      // side — they were signed on paper before import.
      _isLegacy: contract.status === "ACTIVE" && !contract.agentSignature && !contract.tenantSignature,
      // The 10-notice appendix now lives in 入住指南. Only contracts the tenant already signed
      // under the old flow (no click-to-sign evidence) keep showing it, exactly as they signed it.
      _showAppendix: !!contract.tenantSignature && !signEvidence,
    }),
  });
}

async function handlePATCH(
  req: NextRequest,
  { params }: { params: Promise<{ contractId: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ success: false, message: "只有 Admin 可以编辑" }, { status: 403 });
  }
  const { contractId } = await params;
  const contract = await prisma.contract.findUnique({
    where: { contractCode: contractId },
    include: { room: true, tenant: true },
  });
  if (!contract) return NextResponse.json({ success: false, message: "找不到合同" }, { status: 404 });
  if (contract.status === "TERMINATED" || contract.status === "MOVED_OUT" || contract.status === "RENEWED") {
    return NextResponse.json({ success: false, message: "这合同已经终止/搬出/续约结束, 不能再改了" }, { status: 409 });
  }

  const parsed = contractEditSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "资料格式不对" }, { status: 400 });
  }
  const d = parsed.data;

  // A Pro-rata bill only ever opens ONCE per contract — same one-time guarantee the old
  // dedicated "开 Pro-rata 账单" action gave, just folded into the regular save now instead of
  // a separate click. Once that bill exists, the field becomes read-only in effect: resaving
  // the edit form (with the same or a different number in it) never creates a second bill or
  // silently drifts the contract's own prorataAmount out of sync with what was actually billed
  // — correcting it afterward means editing that Payment record directly (the "改金额" button
  // in Payments), same as any other bill.
  const existingProrataBill = await prisma.payment.findFirst({
    where: { contractId: contract.id, notes: PRORATA_NOTE },
  });
  let prorataAmountForTotal = Number(contract.prorataAmount);
  let createProrataBill = false;
  if (!existingProrataBill && d.prorataAmount > 0) {
    if (!d.prorataDueDate) {
      return NextResponse.json({ success: false, message: "填了 Pro-rata 租金就一定要选到期日" }, { status: 400 });
    }
    prorataAmountForTotal = d.prorataAmount;
    createProrataBill = true;
  }

  const total =
    d.roomRental +
    d.securityDeposit +
    d.utilitiesDeposit +
    d.accessCardDeposit +
    d.adminFee +
    d.carparkRental +
    prorataAmountForTotal;

  const newCarparkRoom = d.carparkRoomCode
    ? await prisma.room.findUnique({ where: { roomCode: d.carparkRoomCode } })
    : null;
  if (d.carparkRoomCode) {
    if (!newCarparkRoom || !newCarparkRoom.isCarpark) {
      return NextResponse.json({ success: false, message: "找不到这个车位" }, { status: 404 });
    }
    if (newCarparkRoom.id !== contract.carparkRoomId && newCarparkRoom.status !== "VACANT") {
      return NextResponse.json(
        { success: false, message: `这个车位不是空的 (${newCarparkRoom.status}), 不能分配` },
        { status: 409 }
      );
    }
  }
  const carparkRoomChanged = (newCarparkRoom?.id ?? null) !== (contract.carparkRoomId ?? null);

  // Setting the commission to Paid (and booking the matching Expense) only ever happens
  // through the dedicated /agent-commissions payout flow now — this generic edit can set the
  // amount owed, but never flips Pending to Paid itself, and never touches the amount once
  // paid (the Expense already booked for it would go stale with no trace).
  const wasPaid = contract.commStatus === "Paid";

  await prisma.contract.update({
    where: { contractCode: contractId },
    data: {
      carparkRoomId: newCarparkRoom?.id ?? null,
      tenantName: d.tenantName,
      tenantIc: d.tenantIc,
      moveInDate: d.moveInDate,
      commencementDate: d.commencementDate,
      expiredDate: d.expiredDate,
      tenureMonths: d.tenureMonths,
      roomRental: d.roomRental,
      carparkRental: d.carparkRental,
      securityDeposit: d.securityDeposit,
      utilitiesDeposit: d.utilitiesDeposit,
      earnestDeposit: d.roomRental,
      accessCardDeposit: d.accessCardDeposit,
      adminFee: d.adminFee,
      prorataAmount: prorataAmountForTotal,
      totalOutstanding: total,
      remarks: d.remarks,
      nationality: d.nationality,
      contactNumber: d.contactNumber,
      email: d.email,
      occupation: d.occupation,
      company: d.company,
      carPlate: d.carPlate,
      emergencyName: d.emergencyName,
      emergencyContact: d.emergencyContact,
      emergencyRelationship: d.emergencyRelationship,
      utilDryer: d.utilDryer,
      utilAircond: d.utilAircond,
      utilElectric: d.utilElectric,
      ...(wasPaid ? {} : { commAmount: d.commAmount ?? null, commStatus: "Pending", commPaidAt: null }),
    },
  });

  if (carparkRoomChanged) {
    if (contract.carparkRoomId) {
      const oldCarparkRoom = await prisma.room.findUnique({ where: { id: contract.carparkRoomId } });
      if (oldCarparkRoom?.currentContractId === contractId) {
        await prisma.room.update({
          where: { id: contract.carparkRoomId },
          data: { status: "VACANT", currentContractId: null, currentTenantId: null },
        });
      }
    }
    if (newCarparkRoom) {
      await prisma.room.update({
        where: { id: newCarparkRoom.id },
        data:
          contract.status === "ACTIVE"
            ? { status: "OCCUPIED", currentContractId: contractId, currentTenantId: contract.tenantId }
            : { status: "RESERVED", currentContractId: contractId },
      });
    }
  }

  let prorataMsg = "";
  if (createProrataBill && d.prorataDueDate) {
    const paymentCode = await newId("PY");
    await prisma.payment.create({
      data: {
        paymentCode,
        contractId: contract.id,
        roomCode: contract.room.roomCode,
        tenantId: contract.tenantId,
        tenantName: contract.tenantName,
        type: "RENTAL",
        amountDue: d.prorataAmount,
        amountPaid: 0,
        dueDate: d.prorataDueDate,
        status: "PENDING",
        recordedBy: user.name,
        notes: PRORATA_NOTE,
      },
    });
    if (contract.tenant) {
      await notifyTenantBillCreated(
        contract.tenant,
        {
          paymentCode,
          contractCode: contractId,
          roomCode: contract.room.roomCode,
          type: "RENTAL",
          amountDue: d.prorataAmount,
          amountPaid: 0,
          dueDate: d.prorataDueDate.toISOString(),
        },
        user.name
      );
    }
    prorataMsg = ` | Pro-rata 租金账单已开: RM${d.prorataAmount.toFixed(2)}`;
  }

  return NextResponse.json({ success: true, message: `✅ 合同已更新: ${contractId}${prorataMsg}` });
}

async function handleDELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ contractId: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ success: false, message: "只有 Admin 可以删" }, { status: 403 });
  }
  const { contractId } = await params;
  const contract = await prisma.contract.findUnique({
    where: { contractCode: contractId },
    include: { room: true, carparkRoom: true },
  });
  if (!contract) return NextResponse.json({ success: false, message: "找不到合同" }, { status: 404 });

  if (contract.room.currentContractId === contractId && contract.room.status !== "OCCUPIED") {
    await prisma.room.update({
      where: { id: contract.roomId },
      data: { status: "VACANT", currentContractId: null },
    });
  }
  if (contract.carparkRoom && contract.carparkRoom.currentContractId === contractId && contract.carparkRoom.status !== "OCCUPIED") {
    await prisma.room.update({
      where: { id: contract.carparkRoom.id },
      data: { status: "VACANT", currentContractId: null },
    });
  }

  try {
    await prisma.contract.delete({ where: { contractCode: contractId } });
  } catch (e) {
    // Any failure deleting a contract is, in practice, always a related record (Payment/
    // Commission/MaintenanceRequest/WarningLetter/MoveInOutForm) blocking it via the FK
    // constraint — not just the specific P2003 code, so this always returns a clear JSON
    // error instead of ever letting an exception escape as a non-JSON 500 (which the client
    // can't parse, and would otherwise surface as a misleading "network failed" message).
    console.error("[contracts DELETE]", e);
    return NextResponse.json(
      { success: false, message: "这张合同已经有收款/佣金/报修/警告信等记录, 不能直接删除 — 如果确定要删, 可以用「强制删除」", code: "HAS_RELATED_RECORDS" },
      { status: 409 }
    );
  }

  return NextResponse.json({ success: true, message: "✅ 合同已删, 房间放回空房" });
}

export const PATCH = withActivity(handlePATCH);
export const DELETE = withActivity(handleDELETE);
