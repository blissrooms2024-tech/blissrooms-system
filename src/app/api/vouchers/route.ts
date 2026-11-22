import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { serialize } from "@/lib/serialize";
import { newId } from "@/lib/id";
import { uploadDataUrl } from "@/lib/storage";
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
  contractCode: z.string().trim().min(1, "请选合同"),
  amount: z.coerce.number().positive(),
  reason: z.string().trim().min(1, "请填发放原因"),
  expiryDate: z.string().trim().min(1, "请选截至日期"),
  imageDataUrl: z.string().trim().optional(),
});

/** Admin issues a voucher ahead of time — a standing offer with its own expiry, not yet spent
 * against anything. Nothing financial happens here (no Payment, no Expense); that only
 * happens when the tenant (or Admin on their behalf) later redeems it — see
 * /api/vouchers/[voucherId]/redeem. */
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

  const contract = await prisma.contract.findUnique({
    where: { contractCode: d.contractCode },
    include: { tenant: true },
  });
  if (!contract) return NextResponse.json({ success: false, message: "找不到合同" }, { status: 404 });

  const expiryDate = new Date(d.expiryDate);
  if (isNaN(expiryDate.getTime())) {
    return NextResponse.json({ success: false, message: "日期格式不对" }, { status: 400 });
  }
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  if (expiryDate < startOfToday) {
    return NextResponse.json({ success: false, message: "截至日期不能是过去的日期" }, { status: 400 });
  }

  let imageUrl: string | null = null;
  if (d.imageDataUrl) {
    try {
      imageUrl = await uploadDataUrl(d.imageDataUrl, `VOUCHER_${Date.now()}.png`);
    } catch (e) {
      return NextResponse.json(
        { success: false, message: "图片上传失败: " + (e instanceof Error ? e.message : String(e)) },
        { status: 500 }
      );
    }
  }

  const voucherCode = await newId("VC");
  await prisma.voucher.create({
    data: {
      voucherCode,
      contractId: contract.id,
      tenantId: contract.tenantId,
      tenantName: contract.tenantName,
      amount: d.amount,
      reason: d.reason,
      imageUrl,
      expiryDate,
      issuedBy: user.name,
    },
  });

  if (contract.tenant) {
    await notifyTenantVoucherIssued(
      contract.tenant,
      { voucherCode, amount: d.amount, reason: d.reason, expiryDate },
      user.name
    );
  }

  return NextResponse.json({ success: true, message: `✅ 代金券已发放: ${voucherCode} (RM${d.amount.toFixed(2)})` });
}
