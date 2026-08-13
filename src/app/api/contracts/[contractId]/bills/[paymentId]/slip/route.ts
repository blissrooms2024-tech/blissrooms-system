import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { uploadDataUrl } from "@/lib/storage";
import { notifyAdminsSlipUploaded } from "@/lib/mail";

const schema = z.object({ dataUrl: z.string().min(1) });

/** Tenant uploads a payment slip against a bill Admin issued. Allowed while the bill is
 * PENDING (first upload) or REJECTED (re-upload after Admin rejected the previous slip). */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ contractId: string; paymentId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ success: false, message: "请重新登录" }, { status: 401 });

  const { contractId, paymentId } = await params;
  const c = await prisma.contract.findUnique({ where: { contractCode: contractId } });
  if (!c) return NextResponse.json({ success: false, message: "找不到合同" }, { status: 404 });
  if (c.tenantId !== user.sub) {
    return NextResponse.json({ success: false, message: "只有这张合同的租客本人可以上传水单" }, { status: 403 });
  }

  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.contractId !== c.id) {
    return NextResponse.json({ success: false, message: "找不到这笔账单" }, { status: 404 });
  }
  if (payment.status !== "PENDING" && payment.status !== "REJECTED") {
    return NextResponse.json({ success: false, message: "这笔账单不是等待上传的状态" }, { status: 409 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "请先选图片" }, { status: 400 });
  }

  try {
    const url = await uploadDataUrl(parsed.data.dataUrl, `${contractId}_SLIP_${payment.paymentCode}_${Date.now()}.png`);
    await prisma.payment.update({
      where: { id: paymentId },
      data: {
        receiptLink: url,
        paidDate: new Date(),
        amountPaid: payment.amountDue,
        status: "PENDING_REVIEW",
        reviewNote: null,
        recordedBy: user.name,
      },
    });

    await notifyAdminsSlipUploaded(
      {
        paymentCode: payment.paymentCode,
        contractCode: contractId,
        roomCode: payment.roomCode,
        type: payment.type,
        amountDue: Number(payment.amountDue),
        amountPaid: Number(payment.amountDue),
      },
      c.tenantName,
      user.name
    );

    return NextResponse.json({ success: true, message: "✅ 水单已上传，等 Admin 审核" });
  } catch (e) {
    return NextResponse.json(
      { success: false, message: "上传失败: " + (e instanceof Error ? e.message : String(e)) },
      { status: 500 }
    );
  }
}
