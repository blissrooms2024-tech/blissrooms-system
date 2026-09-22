import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { notifyAdminsMoveOutNotice } from "@/lib/mail";

const schema = z.object({ date: z.string().trim().min(1, "请选日期") });

/** Tenant's self-service alternative to renewal — the contract explicitly puts the choice
 * (renew or move out) on the tenant, so this just records their declared intent and pings
 * Admin, rather than trying to automate anything about the actual move-out (that's still the
 * separate MoveInOutForm condition report, filled once they're actually checking out). */
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
    return NextResponse.json({ success: false, message: "只有这张合同的租客本人可以登记" }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message ?? "资料不对" }, { status: 400 });
  }
  const date = new Date(parsed.data.date);
  if (isNaN(date.getTime())) {
    return NextResponse.json({ success: false, message: "日期格式不对" }, { status: 400 });
  }

  await prisma.contract.update({ where: { id: c.id }, data: { moveOutNoticeDate: date } });

  await notifyAdminsMoveOutNotice(c.contractCode, c.room.roomCode, c.tenantName, parsed.data.date, user.name);

  return NextResponse.json({ success: true, message: "✅ 已登记，Admin 会跟进" });
}
