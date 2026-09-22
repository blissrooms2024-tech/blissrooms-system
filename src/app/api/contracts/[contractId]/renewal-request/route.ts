import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { notifyAdminsRenewalRequested } from "@/lib/mail";

const schema = z.object({ months: z.coerce.number().int().min(1).max(60) });

/** Tenant's self-service half of the "renew or move out" notice (the other half is
 * move-out-notice) — just records how many months they'd like and pings Admin, who still has
 * to actually process it on the 续约管理 page (extends expiredDate + bills the RM200 fee).
 * The contract explicitly reserves Admin's right to decline, so this never auto-extends
 * anything itself. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ contractId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ success: false, message: "请重新登录" }, { status: 401 });

  const { contractId } = await params;
  const c = await prisma.contract.findUnique({ where: { contractCode: contractId }, include: { room: true } });
  if (!c) return NextResponse.json({ success: false, message: "找不到合同" }, { status: 404 });
  if (c.tenantId !== user.sub) {
    return NextResponse.json({ success: false, message: "只有这张合同的租客本人可以申请" }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "请填要续约的月数" }, { status: 400 });
  }
  const { months } = parsed.data;

  await prisma.contract.update({
    where: { id: c.id },
    data: { renewalRequestedAt: new Date(), renewalRequestedMonths: months },
  });

  await notifyAdminsRenewalRequested(c.contractCode, c.room.roomCode, c.tenantName, c.contactNumber, months, user.name);

  return NextResponse.json({ success: true, message: "✅ 已申请续约，Admin 会跟进处理" });
}
