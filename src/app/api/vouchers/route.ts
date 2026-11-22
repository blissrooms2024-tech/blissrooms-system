import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { serialize } from "@/lib/serialize";
import { newId } from "@/lib/id";
import { notifyTenantVoucherIssued } from "@/lib/mail";

/** Every voucher Admin has ever issued, newest first — for the 代金券 admin page. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "BOSS")) {
    return NextResponse.json({ success: false, message: "没有权限" }, { status: 403 });
  }

  const vouchers = await prisma.voucher.findMany({
    orderBy: { issuedAt: "desc" },
    include: { contract: { select: { contractCode: true, roomId: true, room: { select: { roomCode: true } } } } },
  });

  return NextResponse.json({
    success: true,
    vouchers: serialize(
      vouchers.map((v) => ({
        id: v.id,
        voucherCode: v.voucherCode,
        contractCode: v.contract.contractCode,
        roomCode: v.contract.room.roomCode,
        tenantName: v.tenantName,
        amount: v.amount,
        reason: v.reason,
        imageUrl: v.imageUrl,
        template: v.template,
        expiryDate: v.expiryDate,
        status: v.status,
        issuedBy: v.issuedBy,
        issuedAt: v.issuedAt,
        redeemedAt: v.redeemedAt,
      }))
    ),
  });
}

const schema = z.object({
  contractCodes: z.array(z.string().trim().min(1)).min(1, "请至少选一间房"),
  amount: z.coerce.number().positive(),
  reason: z.string().trim().min(1, "请填发放原因"),
  // Defaults to today — lets Admin backdate a voucher to when the reward was actually decided
  // (e.g. entering it a few days after the fact) instead of always stamping "right now".
  issuedDate: z.string().trim().optional(),
  expiryDate: z.string().trim().min(1, "请选截至日期"),
  template: z.enum(["blue", "pink"]).default("blue"),
});

/** Admin issues a voucher ahead of time — a standing offer with its own expiry, not yet spent
 * against anything. Nothing financial happens here (no Payment, no Expense); that only
 * happens when the tenant (or Admin on their behalf) later redeems it — see
 * /api/vouchers/[voucherId]/redeem. Takes a whole batch of contracts at once (Admin picking a
 * handful of rooms to reward together is the common case), issuing one identical voucher per
 * contract rather than making Admin repeat the same form once per room. */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ success: false, message: "只有 Admin 可以发放代金券" }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message ?? "资料不对" }, { status: 400 });
  }
  const d = parsed.data;

  const expiryDate = new Date(d.expiryDate);
  if (isNaN(expiryDate.getTime())) {
    return NextResponse.json({ success: false, message: "日期格式不对" }, { status: 400 });
  }
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  if (expiryDate < startOfToday) {
    return NextResponse.json({ success: false, message: "截至日期不能是过去的日期" }, { status: 400 });
  }

  let issuedAt = new Date();
  if (d.issuedDate) {
    const parsedIssuedAt = new Date(d.issuedDate);
    if (isNaN(parsedIssuedAt.getTime())) {
      return NextResponse.json({ success: false, message: "发放日期格式不对" }, { status: 400 });
    }
    issuedAt = parsedIssuedAt;
  }
  if (issuedAt > expiryDate) {
    return NextResponse.json({ success: false, message: "发放日期不能晚于截至日期" }, { status: 400 });
  }

  const contracts = await prisma.contract.findMany({
    where: { contractCode: { in: d.contractCodes } },
    include: { tenant: true },
  });
  const foundCodes = new Set(contracts.map((c) => c.contractCode));
  const missing = d.contractCodes.filter((code) => !foundCodes.has(code));

  let issuedCount = 0;
  for (const contract of contracts) {
    const voucherCode = await newId("VC");
    await prisma.voucher.create({
      data: {
        voucherCode,
        contractId: contract.id,
        tenantId: contract.tenantId,
        tenantName: contract.tenantName,
        amount: d.amount,
        reason: d.reason,
        template: d.template,
        expiryDate,
        issuedAt,
        issuedBy: user.name,
      },
    });
    issuedCount++;

    if (contract.tenant) {
      await notifyTenantVoucherIssued(
        contract.tenant,
        { voucherCode, amount: d.amount, reason: d.reason, expiryDate },
        user.name
      );
    }
  }

  const missingMsg = missing.length > 0 ? ` | 找不到: ${missing.join(", ")}` : "";
  return NextResponse.json({
    success: true,
    message: `✅ 已发放 ${issuedCount} 张代金券 (每张 RM${d.amount.toFixed(2)})${missingMsg}`,
  });
}
