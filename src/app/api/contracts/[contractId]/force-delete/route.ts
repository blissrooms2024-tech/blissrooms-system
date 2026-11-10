import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { verifyPassword } from "@/lib/auth/password";

const schema = z.object({ password: z.string().min(1, "请输入密码") });

/** Admin's escape hatch for a contract the normal DELETE refuses because it already has
 * payment/commission/maintenance/warning-letter/move-form history — gated behind Admin
 * re-entering their OWN login password (not the contract/tenant's), the same step-up
 * confirmation pattern as changing your own password, so this can't be clicked through by
 * accident. Deletes every one of those related records for this contract, then the contract
 * itself — there is no undo, and every bit of that financial/history record is gone for
 * good. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ contractId: string }> }
) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json({ success: false, message: "只有 Admin 可以强制删除" }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message ?? "请输入密码" }, { status: 400 });
  }

  const adminUser = await prisma.user.findUnique({ where: { id: admin.sub } });
  if (!adminUser) return NextResponse.json({ success: false, message: "找不到账号" }, { status: 404 });
  const passwordOk = await verifyPassword(parsed.data.password, adminUser.passwordHash);
  if (!passwordOk) return NextResponse.json({ success: false, message: "密码不对" }, { status: 400 });

  const { contractId } = await params;
  const contract = await prisma.contract.findUnique({
    where: { contractCode: contractId },
    include: { room: true, carparkRoom: true },
  });
  if (!contract) return NextResponse.json({ success: false, message: "找不到合同" }, { status: 404 });

  try {
    await prisma.$transaction([
      prisma.payment.deleteMany({ where: { contractId: contract.id } }),
      prisma.commission.deleteMany({ where: { contractId: contract.id } }),
      prisma.maintenanceRequest.deleteMany({ where: { contractId: contract.id } }),
      prisma.warningLetter.deleteMany({ where: { contractId: contract.id } }),
      prisma.moveInOutForm.deleteMany({ where: { contractId: contract.id } }),
      prisma.contract.delete({ where: { id: contract.id } }),
    ]);
  } catch (e) {
    console.error("[contracts force-delete]", e);
    return NextResponse.json({ success: false, message: "强制删除失败: " + (e instanceof Error ? e.message : String(e)) }, { status: 500 });
  }

  if (contract.room.currentContractId === contractId) {
    await prisma.room.update({ where: { id: contract.roomId }, data: { status: "VACANT", currentContractId: null, currentTenantId: null } });
  }
  if (contract.carparkRoom && contract.carparkRoom.currentContractId === contractId) {
    await prisma.room.update({ where: { id: contract.carparkRoom.id }, data: { status: "VACANT", currentContractId: null, currentTenantId: null } });
  }

  return NextResponse.json({ success: true, message: "✅ 合同已强制删除 (含所有收款/佣金/报修/警告信记录), 房间放回空房" });
}
