import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { newId } from "@/lib/id";
import { canReviewClaims, isOwnUploadUrl } from "@/lib/claims";
import { withActivity } from "@/lib/activity";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve") }),
  z.object({ action: z.literal("reject"), reason: z.string().trim().min(1).max(300) }),
  z.object({
    action: z.literal("pay"),
    paidAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    paidRef: z.string().trim().max(80).optional().default(""),
    paidSlip: z.string().optional().default(""),
  }),
  /** Boss-only undo of a mistaken approval (before it's been paid back). */
  z.object({ action: z.literal("unapprove") }),
]);

function fail(message: string, status = 400) {
  return NextResponse.json({ success: false, message }, { status });
}

/**
 * Review actions on one claim. Rules:
 *  - only Boss/Admin, and never on a claim they submitted themselves
 *  - approve: PENDING → APPROVED, books a matching Expense (unit/room/category/amount/date)
 *  - reject:  PENDING → REJECTED with a reason the submitter can see
 *  - pay:     APPROVED → PAID, with the transfer date (required) + optional ref no. / slip
 *  - unapprove (Boss only): APPROVED → PENDING, removes the booked Expense
 * Every transition is a conditional update on the current status, so two reviewers clicking
 * at the same time can't both succeed (e.g. booking the expense twice).
 */
async function handlePATCH(req: NextRequest, { params }: { params: Promise<{ claimCode: string }> }) {
  const user = await getCurrentUser();
  if (!user || !canReviewClaims(user)) return fail("只有 Boss / Admin 可以审批报销", 403);

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("资料格式不对");
  const body = parsed.data;

  const { claimCode } = await params;
  const claim = await prisma.expenseClaim.findUnique({ where: { claimCode } });
  if (!claim) return fail("找不到这笔报销", 404);
  if (claim.submittedById === user.sub) return fail("不能审批或付款给自己的报销，请让 Boss 或另一位 Admin 处理", 403);

  const now = new Date();

  if (body.action === "approve") {
    if (claim.status !== "PENDING") return fail("这笔报销已经处理过了", 409);
    const expenseCode = await newId("EX");
    const ok = await prisma.$transaction(async (tx) => {
      const expense = await tx.expense.create({
        data: {
          expenseCode,
          propertyId: claim.propertyId,
          roomId: claim.roomId,
          category: claim.category,
          customLabel: claim.customLabel,
          amount: claim.amount,
          periodMonth: claim.periodMonth,
          expenseDate: claim.expenseDate,
          notes: [`报销 ${claim.claimCode} · ${claim.submittedByName}`, claim.notes].filter(Boolean).join(" — "),
          recordedBy: user.name,
        },
      });
      const updated = await tx.expenseClaim.updateMany({
        where: { id: claim.id, status: "PENDING" },
        data: { status: "APPROVED", expenseId: expense.id, reviewedById: user.sub, reviewedByName: user.name, reviewedAt: now },
      });
      if (updated.count !== 1) throw new Error("ALREADY_HANDLED");
      return true;
    }).catch((e: Error) => (e.message === "ALREADY_HANDLED" ? false : Promise.reject(e)));
    if (!ok) return fail("这笔报销已经处理过了", 409);
    return NextResponse.json({ success: true, message: `✅ 已批准 ${claimCode}，已记入支出 ${expenseCode}` });
  }

  if (body.action === "reject") {
    const updated = await prisma.expenseClaim.updateMany({
      where: { id: claim.id, status: "PENDING" },
      data: { status: "REJECTED", rejectReason: body.reason, reviewedById: user.sub, reviewedByName: user.name, reviewedAt: now },
    });
    if (updated.count !== 1) return fail("这笔报销已经处理过了", 409);
    return NextResponse.json({ success: true, message: `已拒绝 ${claimCode}` });
  }

  if (body.action === "pay") {
    const paidAt = new Date(`${body.paidAt}T00:00:00.000Z`);
    if (isNaN(paidAt.getTime()) || paidAt.getTime() > Date.now() + 24 * 3600 * 1000) return fail("转账日期不能是未来");
    if (body.paidSlip && !isOwnUploadUrl(body.paidSlip)) return fail("转账单文件无效，请重新上传");
    const updated = await prisma.expenseClaim.updateMany({
      where: { id: claim.id, status: "APPROVED" },
      data: {
        status: "PAID",
        paidAt,
        paidRef: body.paidRef || null,
        paidSlip: body.paidSlip || null,
        paidById: user.sub,
        paidByName: user.name,
      },
    });
    if (updated.count !== 1) return fail(claim.status === "PAID" ? "这笔已经记录付款了" : "要先批准才能记录付款", 409);
    return NextResponse.json({ success: true, message: `✅ 已记录付款给 ${claim.submittedByName}（${body.paidAt}）` });
  }

  // unapprove
  if (user.role !== "BOSS") return fail("只有 Boss 可以撤销批准", 403);
  if (claim.status !== "APPROVED") return fail(claim.status === "PAID" ? "已经付款的报销不能撤销" : "这笔报销不是已批准状态", 409);
  const ok = await prisma.$transaction(async (tx) => {
    const updated = await tx.expenseClaim.updateMany({
      where: { id: claim.id, status: "APPROVED" },
      data: { status: "PENDING", expenseId: null, reviewedById: null, reviewedByName: null, reviewedAt: null },
    });
    if (updated.count !== 1) throw new Error("ALREADY_HANDLED");
    if (claim.expenseId) await tx.expense.delete({ where: { id: claim.expenseId } });
    return true;
  }).catch((e: Error) => (e.message === "ALREADY_HANDLED" ? false : Promise.reject(e)));
  if (!ok) return fail("这笔报销状态已经变了，请刷新", 409);
  return NextResponse.json({ success: true, message: `已撤销批准，${claimCode} 回到待审批，相关支出已删除` });
}

/** Withdraw a claim that hasn't been approved: the submitter themselves, or Boss. */
async function handleDELETE(_req: NextRequest, { params }: { params: Promise<{ claimCode: string }> }) {
  const user = await getCurrentUser();
  if (!user) return fail("请重新登录", 401);

  const { claimCode } = await params;
  const claim = await prisma.expenseClaim.findUnique({ where: { claimCode } });
  if (!claim) return fail("找不到这笔报销", 404);
  if (claim.submittedById !== user.sub && user.role !== "BOSS") return fail("只能删除自己的报销", 403);

  const deleted = await prisma.expenseClaim.deleteMany({
    where: { id: claim.id, status: { in: ["PENDING", "REJECTED"] } },
  });
  if (deleted.count !== 1) return fail("已批准或已付款的报销不能删除", 409);
  return NextResponse.json({ success: true, message: `已删除 ${claimCode}` });
}

export const PATCH = withActivity(handlePATCH);
export const DELETE = withActivity(handleDELETE);
