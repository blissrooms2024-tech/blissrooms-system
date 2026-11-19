import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { notifyTenantContractTerminated } from "@/lib/mail";
import { fmtDate } from "@/lib/format";

const schema = z.object({
  reason: z.string().trim().optional().default(""),
});

/** Admin unilaterally ends a contract — for rent arrears, a tenant who's absconded, a breach,
 * or any other reason that can't wait for the lease to run its course. Sets it TERMINATED,
 * frees the room immediately, and records the deposit as forfeited (Finance Overview already
 * treats any TERMINATED contract's deposit as forfeited rather than held). Deliberately not
 * gated on any system-detected condition (e.g. rent arrears) — Admin needs to be able to act
 * the moment they find out a tenant is gone, not wait for a threshold to trip. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ contractId: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ success: false, message: "只有 Admin 可以终止合同" }, { status: 403 });
  }
  const { contractId } = await params;
  const contract = await prisma.contract.findUnique({
    where: { contractCode: contractId },
    include: { room: true, carparkRoom: true, tenant: true },
  });
  if (!contract) return NextResponse.json({ success: false, message: "找不到合同" }, { status: 404 });
  if (contract.status !== "ACTIVE") {
    return NextResponse.json({ success: false, message: "只能终止生效中的合同" }, { status: 409 });
  }

  const { reason } = schema.parse(await req.json().catch(() => ({})));

  const note = `[系统] ${fmtDate(new Date().toISOString())} Admin (${user.name}) 终止合同${reason ? `，原因: ${reason}` : ""}，押金没收。`;

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
      data: { status: "VACANT", currentContractId: null, currentTenantId: null },
    });
  }
  if (contract.carparkRoom && contract.carparkRoom.currentContractId === contract.contractCode) {
    await prisma.room.update({
      where: { id: contract.carparkRoom.id },
      data: { status: "VACANT", currentContractId: null, currentTenantId: null },
    });
  }

  if (contract.tenant) {
    await notifyTenantContractTerminated(contract.tenant, contractId, user.name);
  }

  return NextResponse.json({ success: true, message: "✅ 合同已终止, 押金已标记没收, 房间放回空房" });
}
