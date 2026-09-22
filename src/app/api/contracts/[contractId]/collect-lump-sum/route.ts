import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { uploadDataUrl } from "@/lib/storage";
import { newId } from "@/lib/id";

const BREAKDOWN_ITEMS = ["DEPOSIT", "UTILITIES", "ADMIN_FEE", "ACCESS_CARD", "CARPARK", "RENTAL"] as const;
const CARPARK_ONLY_ITEMS = ["ACCESS_CARD", "CARPARK"] as const;

const schema = z.object({
  amount: z.coerce.number().positive(),
  dataUrl: z.string().trim().optional(),
  paidDate: z.string().trim().optional(),
  method: z.string().trim().optional().default(""),
});

/** Admin/Agent equivalent of the tenant's combined pay-all: most tenants hand over one lump
 * sum (cash, or a single bank transfer) that covers several move-in-package items at once, so
 * staff shouldn't have to record it as several separate one-item entries. Directly marked
 * Paid — same trust level as the existing single-item "记一笔新收款" — with an optional slip
 * photo attached to every row this creates, allocated in priority order (deposit, utilities,
 * admin fee, access card, carpark, rental) the same way the tenant-facing flow does. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ contractId: string }> }
) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "AGENT")) {
    return NextResponse.json({ success: false, message: "只有 Admin 或负责的 Agent 可以记收款" }, { status: 403 });
  }
  const { contractId } = await params;
  const c = await prisma.contract.findUnique({ where: { contractCode: contractId }, include: { room: true } });
  if (!c) return NextResponse.json({ success: false, message: "找不到合同" }, { status: 404 });
  if (user.role === "AGENT" && c.agentId !== user.sub) {
    return NextResponse.json({ success: false, message: "只能帮自己负责的合同记收款" }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "请填金额" }, { status: 400 });
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
  const paidByType: Record<string, number> = {};
  for (const p of allPayments) {
    if (p.status !== "Paid") continue;
    paidByType[p.type] = (paidByType[p.type] || 0) + Number(p.amountPaid);
  }

  const items = c.room.isCarpark ? CARPARK_ONLY_ITEMS : BREAKDOWN_ITEMS;
  const eligible = items
    .map((item) => ({ item, outstanding: Math.max((due[item] || 0) - (paidByType[item] || 0), 0) }))
    .filter((row) => row.outstanding > 0);

  if (eligible.length === 0) {
    return NextResponse.json({ success: false, message: "没有可以收款的项目" }, { status: 400 });
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
    const url = dataUrl ? await uploadDataUrl(dataUrl, `${contractId}_COLLECT_LUMP_${Date.now()}.png`) : null;

    let remaining = amount;
    const created: { item: string; amount: number; full: boolean }[] = [];
    for (const row of eligible) {
      if (remaining <= 0) break;
      const alloc = Math.min(row.outstanding, remaining);
      remaining -= alloc;
      await prisma.payment.create({
        data: {
          paymentCode: await newId("PY"),
          contractId: c.id,
          roomCode: c.room.roomCode,
          tenantId: c.tenantId,
          tenantName: c.tenantName,
          type: row.item,
          amountDue: row.outstanding,
          amountPaid: alloc,
          paidDate: paidDateValue,
          method: method || null,
          status: "Paid",
          receiptLink: url,
          notes: eligible.length > 1 ? "合并收款 (一笔涵盖多个项目)" : null,
          recordedBy: user.name,
        },
      });
      created.push({ item: row.item, amount: alloc, full: alloc >= row.outstanding });
    }

    const partial = created.find((x) => !x.full);
    const message = partial
      ? `✅ 已记 ${created.length} 个项目的收款，其中 ${partial.item} 只收了部分`
      : `✅ 已记 ${created.length} 个项目的收款`;
    return NextResponse.json({ success: true, message });
  } catch (e) {
    return NextResponse.json(
      { success: false, message: "上传失败: " + (e instanceof Error ? e.message : String(e)) },
      { status: 500 }
    );
  }
}
