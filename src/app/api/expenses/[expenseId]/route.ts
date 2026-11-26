import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { withActivity } from "@/lib/activity";

async function handleDELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ expenseId: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ success: false, message: "只有 Admin 可以删除支出记录" }, { status: 403 });
  }

  const { expenseId } = await params;
  const expense = await prisma.expense.findUnique({
    where: { expenseCode: expenseId },
    include: { claim: { select: { claimCode: true } } },
  });
  if (!expense) return NextResponse.json({ success: false, message: "找不到这笔支出" }, { status: 404 });
  if (expense.claim) {
    return NextResponse.json(
      { success: false, message: `这笔支出来自报销 ${expense.claim.claimCode}，请到「报销」页面处理` },
      { status: 409 }
    );
  }

  await prisma.expense.delete({ where: { id: expense.id } });
  return NextResponse.json({ success: true, message: "✅ 支出记录已删除" });
}

export const DELETE = withActivity(handleDELETE);
