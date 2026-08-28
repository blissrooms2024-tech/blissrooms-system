import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { uploadDataUrl } from "@/lib/storage";
import { newId } from "@/lib/id";
import { notifyAdminsSlipUploaded } from "@/lib/mail";

const schema = z.object({
  amount: z.coerce.number().positive(),
  dataUrl: z.string().min(1),
});

/** Tenant self-initiates an aircond (smart meter) top-up: pays into the company account
 * themselves, then reports the amount + uploads proof here — unlike the other bill types,
 * there's no Admin-issued bill to upload against first. Feeds straight into the same
 * PENDING_REVIEW approve/reject queue Admin already uses for slip review. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ contractId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ success: false, message: "请重新登录" }, { status: 401 });

  const { contractId } = await params;
  const c = await prisma.contract.findUnique({ where: { contractCode: contractId }, include: { room: true } });
  if (!c) return NextResponse.json({ success: false, message: "找不到合同" }, { status: 404 });
  if (c.tenantId !== user.sub) {
    return NextResponse.json({ success: false, message: "只有这张合同的租客本人可以充值" }, { status: 403 });
  }
  if (!c.room.hasAircon) {
    return NextResponse.json({ success: false, message: "这间房没有冷气，不能充值" }, { status: 400 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "请填金额并选图片" }, { status: 400 });
  }
  const { amount, dataUrl } = parsed.data;

  const paymentCode = await newId("PY");
  try {
    const url = await uploadDataUrl(dataUrl, `${contractId}_ACTOPUP_${paymentCode}_${Date.now()}.png`);
    await prisma.payment.create({
      data: {
        paymentCode,
        contractId: c.id,
        roomCode: c.room.roomCode,
        tenantId: c.tenantId,
        tenantName: c.tenantName,
        type: "AC",
        amountDue: amount,
        amountPaid: amount,
        paidDate: new Date(),
        status: "PENDING_REVIEW",
        receiptLink: url,
        recordedBy: user.name,
      },
    });

    await notifyAdminsSlipUploaded(
      { paymentCode, contractCode: contractId, roomCode: c.room.roomCode, type: "AC", amountDue: amount, amountPaid: amount },
      c.tenantName,
      user.name
    );

    return NextResponse.json({
      success: true,
      message: "✅ 已提交冷气充值申请，Admin 会在12小时内处理 (只在周一至五, 六日/公共假期不处理)",
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, message: "上传失败: " + (e instanceof Error ? e.message : String(e)) },
      { status: 500 }
    );
  }
}
