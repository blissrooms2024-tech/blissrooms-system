import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { uploadDataUrl } from "@/lib/storage";
import { newId } from "@/lib/id";
import { notifyAdminsSlipUploaded } from "@/lib/mail";

const BREAKDOWN_ITEMS = ["DEPOSIT", "UTILITIES", "ADMIN_FEE", "ACCESS_CARD", "CARPARK", "RENTAL"] as const;
const CARPARK_ONLY_ITEMS = ["ACCESS_CARD", "CARPARK"] as const;

const schema = z.object({
  amount: z.coerce.number().positive(),
  dataUrl: z.string().min(1),
  paidDate: z.string().trim().optional(),
  method: z.string().trim().optional().default(""),
});

/** One lump-sum payment applied across every still-open move-in-package item at once, instead
 * of the tenant uploading a separate slip per item — most tenants send one bank transfer that
 * covers several items together, not one transfer each. A single uploaded slip is attached to
 * every Payment row this creates. If the amount doesn't cover everything, it's allocated in
 * priority order (deposit, then utilities, admin fee, access card, carpark, rental) and
 * whichever item it runs out on is left partially paid — an "installment" on that one item,
 * still outstanding for the difference until the tenant tops it up (or pays it off) next time. */
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
  const { amount, dataUrl, paidDate, method } = parsed.data;

  const due: Record<string, number> = {
    DEPOSIT: Number(c.securityDeposit),
    UTILITIES: Number(c.utilitiesDeposit),
    ADMIN_FEE: Number(c.adminFee),
    ACCESS_CARD: Number(c.accessCardDeposit),
    CARPARK: Number(c.carparkRental),
    RENTAL: Number(c.roomRental),
  };

  const allPayments = await prisma.payment.findMany({ where: { contractId: c.id } });
  const pendingTypes = new Set(allPayments.filter((p) => p.status !== "Paid").map((p) => p.type));
  const paidByType: Record<string, number> = {};
  for (const p of allPayments) {
    if (p.status !== "Paid") continue;
    paidByType[p.type] = (paidByType[p.type] || 0) + Number(p.amountPaid);
  }

  const items = c.room.isCarpark ? CARPARK_ONLY_ITEMS : BREAKDOWN_ITEMS;
  const eligible = items
    .filter((item) => !pendingTypes.has(item))
    .map((item) => ({ item, outstanding: Math.max((due[item] || 0) - (paidByType[item] || 0), 0) }))
    .filter((row) => row.outstanding > 0);

  if (eligible.length === 0) {
    return NextResponse.json({ success: false, message: "没有可以付款的项目" }, { status: 400 });
  }
  const totalOutstanding = eligible.reduce((s, r) => s + r.outstanding, 0);
  if (amount > totalOutstanding) {
    return NextResponse.json(
      { success: false, message: `金额超过还欠总额 (RM${totalOutstanding.toLocaleString()})，请填不超过这个数` },
      { status: 400 }
    );
  }

  try {
    const paidDateValue = paidDate ? new Date(paidDate) : new Date();
    const url = await uploadDataUrl(dataUrl, `${contractId}_BREAKDOWN_ALL_${Date.now()}.png`);

    let remaining = amount;
    const created: { item: string; amount: number; full: boolean }[] = [];
    for (const row of eligible) {
      if (remaining <= 0) break;
      const alloc = Math.min(row.outstanding, remaining);
      remaining -= alloc;
      const paymentCode = await newId("PY");
      await prisma.payment.create({
        data: {
          paymentCode,
          contractId: c.id,
          roomCode: c.room.roomCode,
          tenantId: c.tenantId,
          tenantName: c.tenantName,
          type: row.item,
          amountDue: row.outstanding,
          amountPaid: alloc,
          paidDate: paidDateValue,
          method: method || null,
          status: "PENDING_REVIEW",
          receiptLink: url,
          notes: eligible.length > 1 ? "合并付款 (一笔转账涵盖多个项目)" : null,
          recordedBy: user.name,
        },
      });
      created.push({ item: row.item, amount: alloc, full: alloc >= row.outstanding });
      await notifyAdminsSlipUploaded(
        { paymentCode, contractCode: contractId, roomCode: c.room.roomCode, type: row.item, amountDue: row.outstanding, amountPaid: alloc },
        c.tenantName,
        user.name
      );
    }

    const partial = created.find((x) => !x.full);
    const message = partial
      ? `✅ 交易单已上传，等 Admin 审核 (${created.length} 个项目，其中 ${partial.item} 只付了部分)`
      : `✅ 交易单已上传，等 Admin 审核 (${created.length} 个项目)`;
    return NextResponse.json({ success: true, message });
  } catch (e) {
    return NextResponse.json(
      { success: false, message: "上传失败: " + (e instanceof Error ? e.message : String(e)) },
      { status: 500 }
    );
  }
}
