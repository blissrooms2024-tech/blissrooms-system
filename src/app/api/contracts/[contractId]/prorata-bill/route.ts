import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { newId } from "@/lib/id";
import { notifyTenantBillCreated } from "@/lib/mail";

const schema = z.object({
  amount: z.coerce.number().min(0.01, "请填金额"),
  dueDate: z.string().trim().min(1, "请选到期日"),
});

/** Admin opens a one-off pro-rata rent bill on an EXISTING contract — the same bill the "开新
 *合同" form can create at creation time, for whenever Admin only learns about (or decides) an
 * early move-in after the contract's already been made. A dedicated, explicit action rather
 * than part of the general "编辑" save, so re-saving other edits never risks creating a second
 * one by accident — each click here makes exactly one new bill. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ contractId: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ success: false, message: "只有 Admin 可以开" }, { status: 403 });
  }
  const { contractId } = await params;
  const c = await prisma.contract.findUnique({
    where: { contractCode: contractId },
    include: { room: true, tenant: true },
  });
  if (!c) return NextResponse.json({ success: false, message: "找不到合同" }, { status: 404 });
  if (c.status === "TERMINATED" || c.status === "MOVED_OUT" || c.status === "RENEWED") {
    return NextResponse.json({ success: false, message: "这合同已经结束了, 不能再开账单" }, { status: 409 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message ?? "资料不对" }, { status: 400 });
  }
  const dueDate = new Date(parsed.data.dueDate);
  if (isNaN(dueDate.getTime())) {
    return NextResponse.json({ success: false, message: "日期格式不对" }, { status: 400 });
  }

  const paymentCode = await newId("PY");
  await prisma.payment.create({
    data: {
      paymentCode,
      contractId: c.id,
      roomCode: c.room.roomCode,
      tenantId: c.tenantId,
      tenantName: c.tenantName,
      type: "RENTAL",
      amountDue: parsed.data.amount,
      amountPaid: 0,
      dueDate,
      status: "PENDING",
      recordedBy: user.name,
      notes: "Pro-rata 租金 (提前入住)",
    },
  });
  // So the tenancy agreement document — which only ever reads straight off the Contract's own
  // fields, same as every other move-in charge it prints — picks this up too, not just the
  // billing side.
  await prisma.contract.update({
    where: { id: c.id },
    data: {
      prorataAmount: { increment: parsed.data.amount },
      totalOutstanding: { increment: parsed.data.amount },
    },
  });

  if (c.tenant) {
    await notifyTenantBillCreated(
      c.tenant,
      {
        paymentCode,
        contractCode: c.contractCode,
        roomCode: c.room.roomCode,
        type: "RENTAL",
        amountDue: parsed.data.amount,
        amountPaid: 0,
        dueDate: dueDate.toISOString(),
      },
      user.name
    );
  }

  return NextResponse.json({ success: true, message: `✅ Pro-rata 租金账单已开: RM${parsed.data.amount.toFixed(2)}` });
}
