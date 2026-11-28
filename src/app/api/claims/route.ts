import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { newId } from "@/lib/id";
import { serialize } from "@/lib/serialize";
import { MANUAL_EXPENSE_CATEGORIES } from "@/lib/config";
import {
  canReviewClaims,
  canSubmitClaims,
  canUseClaims,
  isOwnUploadUrl,
  MAX_RECEIPTS_PER_CLAIM,
} from "@/lib/claims";
import { withActivity } from "@/lib/activity";
import { amountFromToken, findSameReceipt, receiptReaderOn } from "@/lib/receiptReader";

const claimInclude = {
  property: { select: { propertyCode: true, name: true } },
  room: { select: { roomCode: true } },
  expense: { select: { expenseCode: true } },
} as const;

/**
 * GET /api/claims?scope=mine|all&status=PENDING
 *  - scope=mine (default): the caller's own claims
 *  - scope=all: everyone's claims — Boss/Admin only
 * Always returns the unit/room pick-list for the submit form and the reviewer queue counts.
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !canUseClaims(user)) {
    return NextResponse.json({ success: false, message: "没有权限" }, { status: 403 });
  }

  const scope = req.nextUrl.searchParams.get("scope") === "all" ? "all" : "mine";
  if (scope === "all" && !canReviewClaims(user)) {
    return NextResponse.json({ success: false, message: "没有权限" }, { status: 403 });
  }
  const statusParam = req.nextUrl.searchParams.get("status");
  const status =
    statusParam && ["PENDING", "APPROVED", "REJECTED", "PAID"].includes(statusParam)
      ? (statusParam as "PENDING" | "APPROVED" | "REJECTED" | "PAID")
      : undefined;

  const [claims, properties, counts] = await Promise.all([
    prisma.expenseClaim.findMany({
      where: {
        ...(scope === "mine" ? { submittedById: user.sub } : {}),
        ...(status ? { status } : {}),
      },
      include: claimInclude,
      orderBy: { createdAt: "desc" },
      take: 300,
    }),
    prisma.property.findMany({
      where: { OR: [{ status: null }, { status: { not: "Inactive" } }] },
      select: {
        propertyCode: true,
        name: true,
        building: { select: { name: true } },
        info: { select: { unitNo: true } },
        rooms: { select: { roomCode: true }, orderBy: { roomCode: "asc" } },
      },
      orderBy: { propertyCode: "asc" },
    }),
    canReviewClaims(user)
      ? prisma.expenseClaim.groupBy({ by: ["status"], _count: { _all: true }, _sum: { amount: true } })
      : Promise.resolve([]),
  ]);

  const summary: Record<string, { count: number; amount: number }> = {};
  for (const c of counts) summary[c.status] = { count: c._count._all, amount: Number(c._sum.amount ?? 0) };

  return NextResponse.json({
    success: true,
    me: user.sub,
    canSubmit: canSubmitClaims(user),
    canReview: canReviewClaims(user),
    // The form reads receipt photos for you (ANTHROPIC_API_KEY set).
    canRead: canSubmitClaims(user) && receiptReaderOn(),
    claims: serialize(
      claims.map((c) => ({
        claimCode: c.claimCode,
        status: c.status,
        isMine: c.submittedById === user.sub,
        submittedByName: c.submittedByName,
        propertyCode: c.property?.propertyCode ?? null,
        propertyName: c.property?.name ?? null,
        roomCode: c.room?.roomCode ?? null,
        category: c.category,
        customLabel: c.customLabel,
        amount: c.amount,
        expenseDate: c.expenseDate,
        periodMonth: c.periodMonth,
        notes: c.notes,
        receipts: c.receipts,
        merchant: c.merchant,
        receiptNo: c.receiptNo,
        receiptAmount: c.receiptAmount,
        reviewedByName: c.reviewedByName,
        reviewedAt: c.reviewedAt,
        rejectReason: c.rejectReason,
        expenseCode: c.expense?.expenseCode ?? null,
        paidAt: c.paidAt,
        paidRef: c.paidRef,
        paidSlip: c.paidSlip,
        paidByName: c.paidByName,
        createdAt: c.createdAt,
      }))
    ),
    // The form picks a condo first, then the unit number in it.
    properties: properties.map(({ building, info, ...p }) => ({ ...p, building: building?.name ?? null, unitNo: info?.unitNo ?? null })),
    summary,
  });
}

const schema = z.object({
  /** Empty = company overhead (not tied to a unit). */
  propertyCode: z.string().trim().optional().default(""),
  roomCode: z.string().trim().optional().default(""),
  category: z.enum(MANUAL_EXPENSE_CATEGORIES),
  customLabel: z.string().trim().max(60).optional().default(""),
  amount: z.coerce.number().positive().max(1_000_000),
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().trim().max(500).optional().default(""),
  receipts: z.array(z.string().min(1)).min(1).max(MAX_RECEIPTS_PER_CLAIM),
  /** As read off the receipt (staff can correct them). */
  merchant: z.string().trim().max(80).optional().default(""),
  receiptNo: z.string().trim().max(40).optional().default(""),
  /** From /api/claims/read: carries the total the photos were read as. */
  readToken: z.string().max(2000).optional().default(""),
  /** The person saw the "already claimed?" warning and is sure. */
  allowDuplicate: z.boolean().optional().default(false),
});

async function handlePOST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !canSubmitClaims(user)) {
    return NextResponse.json({ success: false, message: "只有 Admin 和 Worker 可以提交报销" }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const missingReceipt = parsed.error.issues.some((i) => i.path[0] === "receipts");
    return NextResponse.json(
      { success: false, message: missingReceipt ? "请至少上传一张单据照片" : "资料格式不对" },
      { status: 400 }
    );
  }
  const d = parsed.data;
  if (d.category === "OTHER" && !d.customLabel) {
    return NextResponse.json({ success: false, message: "「其他」类型要填支出名称" }, { status: 400 });
  }
  if (!d.receipts.every(isOwnUploadUrl)) {
    return NextResponse.json({ success: false, message: "单据文件无效，请重新上传" }, { status: 400 });
  }
  const expenseDate = new Date(`${d.expenseDate}T00:00:00.000Z`);
  if (isNaN(expenseDate.getTime()) || expenseDate.getTime() > Date.now() + 24 * 3600 * 1000) {
    return NextResponse.json({ success: false, message: "消费日期不能是未来" }, { status: 400 });
  }

  let propertyId: string | null = null;
  let roomId: string | null = null;
  if (d.propertyCode) {
    const property = await prisma.property.findUnique({ where: { propertyCode: d.propertyCode } });
    if (!property) return NextResponse.json({ success: false, message: "找不到这个单位" }, { status: 404 });
    propertyId = property.id;
    if (d.roomCode) {
      const room = await prisma.room.findUnique({ where: { roomCode: d.roomCode } });
      if (!room || room.propertyId !== property.id) {
        return NextResponse.json({ success: false, message: "这个房间不属于所选单位" }, { status: 400 });
      }
      roomId = room.id;
    }
  } else if (d.roomCode) {
    return NextResponse.json({ success: false, message: "选房间前要先选单位" }, { status: 400 });
  }

  // The same receipt claimed twice (same receipt no., or same shop, day and amount): ask first.
  if (!d.allowDuplicate) {
    const sameAs = await findSameReceipt({ merchant: d.merchant || null, receiptNo: d.receiptNo || null, amount: d.amount, date: d.expenseDate });
    if (sameAs.length) {
      return NextResponse.json(
        { success: false, sameAs, message: `这张单据好像已经报过：${sameAs.map((c) => c.claimCode).join("、")}` },
        { status: 409 }
      );
    }
  }
  const receiptAmount = d.readToken ? await amountFromToken(d.readToken, user.sub, d.receipts) : null;

  const claimCode = await newId("CL");
  await prisma.expenseClaim.create({
    data: {
      claimCode,
      submittedById: user.sub,
      submittedByName: user.name,
      propertyId,
      roomId,
      category: d.category,
      customLabel: d.customLabel || null,
      amount: d.amount,
      expenseDate,
      periodMonth: d.expenseDate.slice(0, 7),
      notes: d.notes || null,
      receipts: d.receipts,
      merchant: d.merchant || null,
      receiptNo: d.receiptNo || null,
      receiptAmount,
    },
  });

  return NextResponse.json({ success: true, claimCode, message: `✅ 报销已提交: ${claimCode}，等待审批` });
}

export const POST = withActivity(handlePOST);
