import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ expenseId: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ success: false, message: "只有 Admin 可以删除支出记录" }, { status: 403 });
  }

  const { expenseId } = await params;
  const expense = await prisma.expense.findUnique({ where: { expenseCode: expenseId } });
  if (!expense) return NextResponse.json({ success: false, message: "找不到这笔支出" }, { status: 404 });

  await prisma.expense.delete({ where: { id: expense.id } });
  return NextResponse.json({ success: true, message: "✅ 支出记录已删除" });
}
