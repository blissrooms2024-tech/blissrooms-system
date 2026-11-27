import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { newId } from "@/lib/id";
import { computeCreditBalance } from "@/lib/creditBalance";
import { withActivity } from "@/lib/activity";

const schema = z.object({ creditBalance: z.coerce.number().min(0, "请填金额") });

/** Admin-only correction of a contract's prepaid credit balance. The balance is never a single
 * stored number to overwrite — it's always the live sum of this contract's CREDIT-type Payment
 * rows — so a correction here is itself just one more row, for the difference between what
 * Admin says it should be and what the ledger currently adds up to, same as every other Admin
 * correction in this system leaves its own trace instead of silently editing history. */
async function handlePATCH(
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

  const current = await computeCreditBalance(c.id);
  const diff = parsed.data.creditBalance - current;
  if (diff === 0) {
    return NextResponse.json({ success: true, message: "✅ 预收余额没有变化" });
  }

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

  return NextResponse.json({ success: true, message: "✅ 预收余额已更新" });
}

export const PATCH = withActivity(handlePATCH);
