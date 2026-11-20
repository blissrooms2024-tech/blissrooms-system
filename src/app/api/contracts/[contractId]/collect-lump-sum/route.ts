import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { uploadDataUrl } from "@/lib/storage";
import { newId } from "@/lib/id";
import { fmtMoney } from "@/lib/format";
import { computeBillBreakdown } from "@/lib/billBreakdown";

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

  // Same due/paid/outstanding math as the Payments breakdown and everywhere else a contract's
  // totals are shown — this route used to compute "due" from the contract's reference rates
  // alone (ignoring anything already billed beyond that), so its own "还欠总额" cap could land
  // on a completely different number than what Admin/Agent could actually see on screen.
  const allPayments = await prisma.payment.findMany({ where: { contractId: c.id } });
  const { breakdown } = computeBillBreakdown(c, allPayments, c.room.isCarpark);
  const eligible = breakdown.filter((row) => row.outstanding > 0);

  try {
    const paidDateValue = paidDate ? new Date(paidDate) : new Date();
    const url = dataUrl ? await uploadDataUrl(dataUrl, `${contractId}_COLLECT_LUMP_${Date.now()}.png`) : null;

    let remaining = amount;
    const created: { item: string; amount: number; full: boolean }[] = [];
    for (const row of eligible) {
      if (remaining <= 0) break;
      const alloc = Math.min(row.outstanding, remaining);
      remaining -= alloc;

      // If this item already has an open (PENDING/REJECTED) bill and this payment fully covers
      // it, settle THAT bill directly instead of creating a brand-new record for the same
      // money — this used to always create a fresh row regardless, leaving the original bill
      // dangling open while a second record counted the same cash, inflating "应收" further
      // every time lump-sum collection was used on an item that already had a bill out.
      const openBill = allPayments.find((p) => p.type === row.item && (p.status === "PENDING" || p.status === "REJECTED"));
      const openBillRemainder = openBill ? Math.max(Number(openBill.amountDue) - Number(openBill.amountPaid), 0) : 0;

      if (openBill && openBillRemainder > 0 && alloc >= openBillRemainder) {
        await prisma.payment.update({
          where: { id: openBill.id },
          data: {
            status: "Paid",
            amountPaid: openBill.amountDue,
            paidDate: paidDateValue,
            method: method || openBill.method,
            receiptLink: url ?? openBill.receiptLink,
            reviewedBy: user.name,
            reviewedAt: new Date(),
            reviewNote: null,
          },
        });
        // Any extra beyond that bill's own amount (this item's "due" can also include an
        // unbilled remainder on top of it) still needs its own ad-hoc record.
        const extra = alloc - openBillRemainder;
        if (extra > 0) {
          await prisma.payment.create({
            data: {
              paymentCode: await newId("PY"),
              contractId: c.id,
              roomCode: c.room.roomCode,
              tenantId: c.tenantId,
              tenantName: c.tenantName,
              type: row.item,
              amountDue: extra,
              amountPaid: extra,
              paidDate: paidDateValue,
              method: method || null,
              status: "Paid",
              receiptLink: url,
              notes: "合并收款 (一笔涵盖多个项目)",
              recordedBy: user.name,
            },
          });
        }
      } else {
        // amountDue is exactly what this record actually collects (alloc), never the item's
        // full outstanding — this used to put the FULL outstanding here even on a partial
        // allocation, so a partially-covered item's "应收" kept silently inflating by its own
        // still-unpaid remainder every time a partial lump-sum touched it, on top of what was
        // already owed. The real remaining shortfall (row.outstanding - alloc, if any) simply
        // stays unbilled, to be collected by a later payment same as any other never-yet-billed
        // amount.
        await prisma.payment.create({
          data: {
            paymentCode: await newId("PY"),
            contractId: c.id,
            roomCode: c.room.roomCode,
            tenantId: c.tenantId,
            tenantName: c.tenantName,
            type: row.item,
            amountDue: alloc,
            amountPaid: alloc,
            paidDate: paidDateValue,
            method: method || null,
            status: "Paid",
            receiptLink: url,
            notes: eligible.length > 1 ? "合并收款 (一笔涵盖多个项目)" : null,
            recordedBy: user.name,
          },
        });
      }
      created.push({ item: row.item, amount: alloc, full: alloc >= row.outstanding });
    }

    // Anything left over after every owing item is fully covered is money paid ahead — banked
    // on the contract as credit instead of rejecting the payment outright, and automatically
    // consumed in full the next time a new bill this contract gets opened for an amount the
    // credit can cover.
    if (remaining > 0) {
      await prisma.contract.update({ where: { id: c.id }, data: { creditBalance: { increment: remaining } } });
    }

    const partial = created.find((x) => !x.full);
    const creditMsg = remaining > 0 ? ` | 多收 ${fmtMoney(remaining)} 已记为预收余额` : "";
    const message =
      created.length === 0
        ? `✅ 已记为预收余额: ${fmtMoney(remaining)}`
        : partial
          ? `✅ 已记 ${created.length} 个项目的收款，其中 ${partial.item} 只收了部分${creditMsg}`
          : `✅ 已记 ${created.length} 个项目的收款${creditMsg}`;
    return NextResponse.json({ success: true, message });
  } catch (e) {
    return NextResponse.json(
      { success: false, message: "上传失败: " + (e instanceof Error ? e.message : String(e)) },
      { status: 500 }
    );
  }
}
