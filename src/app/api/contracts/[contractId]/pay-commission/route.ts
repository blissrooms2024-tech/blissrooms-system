import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { newId } from "@/lib/id";
import { withActivity } from "@/lib/activity";

/** Admin-only: the ONLY place an Agent's commission actually gets paid out and booked as a
 * real COMMISSION Expense — entering the amount (Edit Contract) only records what's owed,
 * same split as a maintenance job's cost vs its pay-out. Blocked once already Paid so this can
 * never double-book, and if the room has no property to book against, pays it anyway but warns
 * (same convention as the maintenance payout). */
async function handlePOST(
  _req: NextRequest,
  { params }: { params: Promise<{ contractId: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ success: false, message: "只有 Admin 可以发放佣金" }, { status: 403 });
  }

  const { contractId } = await params;
  const contract = await prisma.contract.findUnique({
    where: { contractCode: contractId },
    include: { room: { select: { propertyId: true } }, agent: { select: { name: true } } },
  });
  if (!contract) return NextResponse.json({ success: false, message: "找不到合同" }, { status: 404 });
  if (contract.commAmount === null) {
    return NextResponse.json({ success: false, message: "这张合同还没填佣金金额" }, { status: 409 });
  }
  if (contract.commStatus === "Paid") {
    return NextResponse.json({ success: false, message: "这张合同的佣金已经发过了" }, { status: 409 });
  }

  const now = new Date();
  await prisma.contract.update({
    where: { contractCode: contractId },
    data: { commStatus: "Paid", commPaidAt: now },
  });

  let expenseWarning = "";
  const propertyId = contract.room.propertyId;
  const amount = Number(contract.commAmount);
  if (propertyId) {
    await prisma.expense.create({
      data: {
        expenseCode: await newId("EX"),
        propertyId,
        category: "COMMISSION",
        customLabel: contract.agent.name,
        amount,
        periodMonth: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
        expenseDate: now,
        notes: `Agent 佣金 — ${contract.agent.name} (合同 ${contract.contractCode}, 租客 ${contract.tenantName})`,
        recordedBy: user.name,
      },
    });
  } else {
    expenseWarning = " | ⚠️ 这间房没有关联楼盘，没有登记支出";
  }

  return NextResponse.json({
    success: true,
    message: `✅ 佣金已发放: RM${amount.toFixed(2)} (${contract.agent.name})${expenseWarning}`,
  });
}

export const POST = withActivity(handlePOST);
