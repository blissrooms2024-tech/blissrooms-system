import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { uploadDataUrl } from "@/lib/storage";
import { newId } from "@/lib/id";
import { notifyAdminsSlipUploaded } from "@/lib/mail";

const BREAKDOWN_ITEMS = ["DEPOSIT", "UTILITIES", "ADMIN_FEE", "ACCESS_CARD", "RENTAL"] as const;

const schema = z.object({
  item: z.enum(BREAKDOWN_ITEMS),
  amount: z.coerce.number().positive(),
  dataUrl: z.string().min(1),
});

/** Tenant self-initiates payment on a move-in-package item (deposit/utilities/admin fee/
 * access card/rental) that's still outstanding but that Admin hasn't opened a bill for yet —
 * without this, a brand-new tenant with a fresh contract has no way to pay anything until
 * Admin manually opens a bill for every single item. Mirrors the AC top-up self-serve flow. */
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
    return NextResponse.json({ success: false, message: "只有这张合同的租客本人可以付款" }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "请填金额并选图片" }, { status: 400 });
  }
  const { item, amount, dataUrl } = parsed.data;

  const due: Record<string, number> = {
    DEPOSIT: Number(c.securityDeposit),
    UTILITIES: Number(c.utilitiesDeposit),
    ADMIN_FEE: Number(c.adminFee),
    ACCESS_CARD: Number(c.accessCardDeposit),
    RENTAL: Number(c.roomRental),
  };

  const existing = await prisma.payment.findMany({ where: { contractId: c.id, type: item } });
  if (existing.some((p) => p.status !== "Paid")) {
    return NextResponse.json(
      { success: false, message: "这个项目已经有一笔账单在处理中，请到「待处理账单」上传" },
      { status: 409 }
    );
  }
  const alreadyPaid = existing.filter((p) => p.status === "Paid").reduce((s, p) => s + Number(p.amountPaid), 0);
  const outstanding = Math.max((due[item] || 0) - alreadyPaid, 0);
  if (outstanding <= 0) {
    return NextResponse.json({ success: false, message: "这个项目已经付清了" }, { status: 400 });
  }

  const paymentCode = await newId("PY");
  try {
    const url = await uploadDataUrl(dataUrl, `${contractId}_BREAKDOWN_${item}_${paymentCode}_${Date.now()}.png`);
    await prisma.payment.create({
      data: {
        paymentCode,
        contractId: c.id,
        roomCode: c.room.roomCode,
        tenantId: c.tenantId,
        tenantName: c.tenantName,
        type: item,
        amountDue: amount,
        amountPaid: amount,
        paidDate: new Date(),
        status: "PENDING_REVIEW",
        receiptLink: url,
        recordedBy: user.name,
      },
    });

    await notifyAdminsSlipUploaded(
      { paymentCode, contractCode: contractId, roomCode: c.room.roomCode, type: item, amountDue: amount, amountPaid: amount },
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
