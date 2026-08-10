import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, type SessionPayload } from "@/lib/auth/session";
import { serialize } from "@/lib/serialize";
import { contractFormSchema } from "@/lib/schemas/contract";

function canView(user: SessionPayload, contract: { agentId: string; tenantId: string | null }) {
  if (user.role === "BOSS" || user.role === "ADMIN") return true;
  if (user.role === "AGENT" && contract.agentId === user.sub) return true;
  if (user.role === "TENANT" && contract.tenantId === user.sub) return true;
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
    include: { room: true, agent: true },
  });
  if (!contract) return NextResponse.json({ success: false, message: "找不到合同" }, { status: 404 });
  if (!canView(user, contract)) {
    return NextResponse.json({ success: false, message: "没有权限查看这张合同" }, { status: 403 });
  }

  return NextResponse.json({
    success: true,
    contract: serialize({ ...contract, agentIc: contract.agent.ic }),
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
  if (contract.status !== "DRAFT" && contract.status !== "PENDING_APPROVE") {
    return NextResponse.json({ success: false, message: "这合同已经批准/生效, 不能再改了" }, { status: 409 });
  }

  const parsed = contractFormSchema
    .omit({ roomCode: true, agentId: true })
    .safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "资料格式不对" }, { status: 400 });
  }
  const d = parsed.data;
  const total =
    d.roomRental + d.securityDeposit + d.utilitiesDeposit + d.accessCardDeposit + d.adminFee + d.carparkRental;

  await prisma.contract.update({
    where: { contractCode: contractId },
    data: {
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
    },
  });

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
  const contract = await prisma.contract.findUnique({ where: { contractCode: contractId }, include: { room: true } });
  if (!contract) return NextResponse.json({ success: false, message: "找不到合同" }, { status: 404 });

  if (contract.room.currentContractId === contractId && contract.room.status !== "OCCUPIED") {
    await prisma.room.update({
      where: { id: contract.roomId },
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
