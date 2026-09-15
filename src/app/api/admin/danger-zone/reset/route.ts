import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";

const CONFIRM_PHRASE = "DELETE ALL";

const schema = z.object({ confirmText: z.string() });

/** Wipes every business-data table (properties/rooms/contracts/payments/commissions/move
 * forms/maintenance/warning letters/logs/id counters) and every non-ADMIN user, keeping ADMIN
 * accounts untouched so whoever runs this can still log in afterward. Requires the exact
 * confirmation phrase to guard against a stray click — this cannot be undone. */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ success: false, message: "只有 Admin 可以执行这个操作" }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success || parsed.data.confirmText !== CONFIRM_PHRASE) {
    return NextResponse.json({ success: false, message: `请正确输入确认文字: ${CONFIRM_PHRASE}` }, { status: 400 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const payments = await tx.payment.deleteMany({});
    const commissions = await tx.commission.deleteMany({});
    const moveForms = await tx.moveInOutForm.deleteMany({});
    const maintenance = await tx.maintenanceRequest.deleteMany({});
    const warningLetters = await tx.warningLetter.deleteMany({});
    const contracts = await tx.contract.deleteMany({});
    const rooms = await tx.room.deleteMany({});
    const properties = await tx.property.deleteMany({});
    const logs = await tx.log.deleteMany({});
    await tx.counter.deleteMany({});
    const users = await tx.user.deleteMany({ where: { role: { not: "ADMIN" } } });

    return {
      users: users.count,
      properties: properties.count,
      rooms: rooms.count,
      contracts: contracts.count,
      payments: payments.count,
      commissions: commissions.count,
      moveForms: moveForms.count,
      maintenance: maintenance.count,
      warningLetters: warningLetters.count,
      logs: logs.count,
    };
  });

  return NextResponse.json({ success: true, message: "✅ 已清空所有资料，只留 Admin 账号", result });
}
