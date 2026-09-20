import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, type SessionPayload } from "@/lib/auth/session";
import { serialize } from "@/lib/serialize";
import { contractEditSchema } from "@/lib/schemas/contract";
import { RENT_ARREARS } from "@/lib/config";

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

  const [paidAgg, escalatedBill, moveInForm] = await Promise.all([
    prisma.payment.aggregate({
      where: { contractId: contract.id, status: "Paid" },
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
  ]);
  const paid = Number(paidAgg._sum.amountPaid ?? 0);
  const outstanding = Math.max(Number(contract.totalOutstanding) - paid, 0);

  const { agent, ...rest } = contract;
  return NextResponse.json({
    success: true,
    contract: serialize({
      ...rest,
      agentIc: agent.ic,
      _paid: paid,
      _outstanding: outstanding,
      _rentEscalated: !!escalatedBill,
      _moveInDone: !!moveInForm,
      // Legacy-imported contracts go straight to ACTIVE with no digital signature on either
      // side — they were signed on paper before import.
      _isLegacy: contract.status === "ACTIVE" && !contract.agentSignature && !contract.tenantSignature,
    }),
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ contractId: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ success: false, message: "只有 Admin 可以编辑" }, { status: 403 });
  }
  const { contractId } = await params;
  const contract = await prisma.contract.findUnique({ where: { contractCode: contractId } });
  if (!contract) return NextResponse.json({ success: false, message: "找不到合同" }, { status: 404 });
  if (contract.status === "TERMINATED" || contract.status === "MOVED_OUT") {
    return NextResponse.json({ success: false, message: "这合同已经终止/搬出, 不能再改了" }, { status: 409 });
  }

  const parsed = contractEditSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "资料格式不对" }, { status: 400 });
  }
  const d = parsed.data;
  const total =
    d.roomRental + d.securityDeposit + d.utilitiesDeposit + d.accessCardDeposit + d.adminFee + d.carparkRental;

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

  const commAmount = d.commAmount ?? null;
  const wasPaid = contract.commStatus === "Paid";
  const nowPaid = commAmount !== null && d.commStatus === "Paid";
  const commPaidAt = nowPaid ? (wasPaid ? contract.commPaidAt : new Date()) : null;

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
      commAmount,
      commStatus: commAmount !== null ? d.commStatus : "Pending",
      commPaidAt,
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

  return NextResponse.json({ success: true, message: `✅ 合同已更新: ${contractId}` });
}

export async function DELETE(
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
    if (e && typeof e === "object" && "code" in e && e.code === "P2003") {
      return NextResponse.json(
        { success: false, message: "这张合同已经有收款/佣金记录, 不能直接删除" },
        { status: 409 }
      );
    }
    throw e;
  }

  return NextResponse.json({ success: true, message: "✅ 合同已删, 房间放回空房" });
}
