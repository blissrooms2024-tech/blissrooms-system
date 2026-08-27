import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { RENT_ARREARS } from "@/lib/config";
import { notifyTenantContractTerminated } from "@/lib/mail";

/** Admin manually confirms ending a contract for rent arrears — sets it TERMINATED, frees the
 * room, and records that the deposit is forfeited. This is deliberately a manual, explicit
 * action: the cron only notifies Admin once arrears cross the escalation threshold, it never
 * calls this itself. */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ contractId: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ success: false, message: "只有 Admin 可以终止合同" }, { status: 403 });
  }
  const { contractId } = await params;
  const contract = await prisma.contract.findUnique({ where: { contractCode: contractId }, include: { room: true, tenant: true } });
  if (!contract) return NextResponse.json({ success: false, message: "找不到合同" }, { status: 404 });
  if (contract.status === "TERMINATED" || contract.status === "MOVED_OUT") {
    return NextResponse.json({ success: false, message: "这张合同已经结束了" }, { status: 409 });
  }

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const escalationCutoff = new Date(startOfToday.getTime() - RENT_ARREARS.ESCALATION_DAYS * 24 * 3600 * 1000);
  const overdueRent = await prisma.payment.findFirst({
    where: { contractId: contract.id, type: "RENTAL", status: "PENDING", dueDate: { lte: escalationCutoff } },
  });
  if (!overdueRent) {
    return NextResponse.json(
      { success: false, message: `这张合同没有逾期超过 ${RENT_ARREARS.ESCALATION_DAYS} 天的房租, 不能用这个操作终止` },
      { status: 409 }
    );
  }

  const note = `[系统] ${new Date().toISOString().slice(0, 10)} 因房租逾期超过 ${RENT_ARREARS.ESCALATION_DAYS} 天未缴, Admin (${user.name}) 终止合同, 押金没收。`;

  await prisma.contract.update({
    where: { contractCode: contractId },
    data: {
      status: "TERMINATED",
      remarks: contract.remarks ? `${contract.remarks}\n${note}` : note,
    },
  });

  if (contract.room.currentContractId === contract.contractCode) {
    await prisma.room.update({
      where: { id: contract.roomId },
      data: { status: "VACANT", currentContractId: null },
    });
  }

  if (contract.tenant) {
    await notifyTenantContractTerminated(contract.tenant, contractId, user.name);
  }

  return NextResponse.json({ success: true, message: "✅ 合同已终止, 押金已标记没收, 房间放回空房" });
}
