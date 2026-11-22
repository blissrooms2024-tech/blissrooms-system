import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { uploadDataUrl } from "@/lib/storage";
import { allocateLumpSum, allocationMessage } from "@/lib/allocatePayment";

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

  try {
    const paidDateValue = paidDate ? new Date(paidDate) : new Date();
    const url = dataUrl ? await uploadDataUrl(dataUrl, `${contractId}_COLLECT_LUMP_${Date.now()}.png`) : null;

    const result = await allocateLumpSum({
      contract: c,
      amount,
      paidDateValue,
      method: method || null,
      receiptUrl: url,
      recordedByName: user.name,
      reviewerName: user.name,
      adHocNotesSingle: null,
      adHocNotesMultiple: "合并收款 (一笔涵盖多个项目)",
      creditNotes: "预收余额 (一笔过收款多收)",
    });

    return NextResponse.json({ success: true, message: allocationMessage(result) });
  } catch (e) {
    return NextResponse.json(
      { success: false, message: "上传失败: " + (e instanceof Error ? e.message : String(e)) },
      { status: 500 }
    );
  }
}
