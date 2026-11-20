import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { newId } from "@/lib/id";

const schema = z.object({ creditBalance: z.coerce.number().min(0, "请填金额") });

/** Admin-only direct correction of a contract's prepaid credit balance — for whenever the
 * running total (built up/consumed automatically by lump-sum overpayment and auto-settled
 * bills) doesn't match what Admin knows is actually true, the same escape hatch every other
 * amount in the system already has via "改金额".
 *
 * Unlike a plain "改金额" on an existing record, this one has nothing to directly correct — the
 * balance is a running total, not a single row — so the correction itself is recorded as a new
 * CREDIT-type Payment row for the difference (Admin keys in a number; the record of that entry
 * is what makes it an adjustment Admin can account for later, not just an invisible edit). */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ contractId: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ success: false, message: "只有 Admin 可以改" }, { status: 403 });
  }
  const { contractId } = await params;
  const c = await prisma.contract.findUnique({ where: { contractCode: contractId }, include: { room: true } });
  if (!c) return NextResponse.json({ success: false, message: "找不到合同" }, { status: 404 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message ?? "资料不对" }, { status: 400 });
  }

  const diff = parsed.data.creditBalance - Number(c.creditBalance);
  if (diff !== 0) {
    await prisma.payment.create({
      data: {
        paymentCode: await newId("PY"),
        contractId: c.id,
        roomCode: c.room.roomCode,
        tenantId: c.tenantId,
        tenantName: c.tenantName,
        type: "CREDIT",
        amountDue: diff,
        amountPaid: diff,
        paidDate: new Date(),
        status: "Paid",
        notes: `Admin 手动调整预收余额 (由 ${user.name} 修改)`,
        recordedBy: user.name,
      },
    });
  }

  await prisma.contract.update({
    where: { id: c.id },
    data: { creditBalance: parsed.data.creditBalance },
  });

  return NextResponse.json({ success: true, message: "✅ 预收余额已更新" });
}
