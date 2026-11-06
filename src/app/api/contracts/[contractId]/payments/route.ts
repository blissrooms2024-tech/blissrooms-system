import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, type SessionPayload } from "@/lib/auth/session";
import { serialize } from "@/lib/serialize";
import { newId } from "@/lib/id";

function canView(user: SessionPayload, contract: { agentId: string; tenantId: string | null }) {
  if (user.role === "BOSS" || user.role === "ADMIN") return true;
  if (user.role === "AGENT" && contract.agentId === user.sub) return true;
  // Not gated on role === "TENANT": an Agent can also be the tenant on their own contract.
  if (contract.tenantId === user.sub) return true;
  return false;
}

const BREAKDOWN_ITEMS = ["DEPOSIT", "UTILITIES", "ADMIN_FEE", "ACCESS_CARD", "CARPARK", "RENTAL"] as const;
// A contract whose own room IS a carpark (roomCode ends in -CPxx) only ever has RFID/access
// card deposit + the carpark rent itself — security/utility deposit, admin fee and room rental
// stay 0 forever, so showing them as "cleared RM0" rows just clutters the tenant's bill view.
const CARPARK_ONLY_ITEMS = ["ACCESS_CARD", "CARPARK"] as const;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ contractId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ success: false, message: "请重新登录" }, { status: 401 });

  const { contractId } = await params;
  const c = await prisma.contract.findUnique({
    where: { contractCode: contractId },
    include: { agent: { select: { ic: true } }, room: { select: { hasAircon: true, isCarpark: true } } },
  });
  if (!c) return NextResponse.json({ success: false, message: "找不到合同" }, { status: 404 });
  if (!canView(user, c)) {
    return NextResponse.json({ success: false, message: "没有权限查看这张合同" }, { status: 403 });
  }

  const payments = await prisma.payment.findMany({
    where: { contractId: c.id },
    orderBy: { id: "desc" },
  });

  // A recurring type (RENTAL/CARPARK) gets billed again every month, so its lifetime "due" has
  // to grow with every bill issued — the contract's own roomRental/carparkRental is only a
  // single month's reference rate. Using whichever is larger keeps a never-yet-billed item
  // showing its sensible default (the reference rate, before any bill exists) while letting
  // "应收" track reality once multiple months have actually been billed — otherwise "已收"
  // outgrowing a stuck-at-one-month "应收" looks like a data error to Admin.
  const billedTotalByType: Record<string, number> = {};
  for (const p of payments) {
    billedTotalByType[p.type] = (billedTotalByType[p.type] || 0) + Number(p.amountDue);
  }
  const due: Record<string, number> = {
    DEPOSIT: Math.max(Number(c.securityDeposit), billedTotalByType.DEPOSIT || 0),
    UTILITIES: Math.max(Number(c.utilitiesDeposit), billedTotalByType.UTILITIES || 0),
    ADMIN_FEE: Math.max(Number(c.adminFee), billedTotalByType.ADMIN_FEE || 0),
    ACCESS_CARD: Math.max(Number(c.accessCardDeposit), billedTotalByType.ACCESS_CARD || 0),
    CARPARK: Math.max(Number(c.carparkRental), billedTotalByType.CARPARK || 0),
    RENTAL: Math.max(Number(c.roomRental), billedTotalByType.RENTAL || 0),
  };
  const paidByType: Record<string, number> = {};
  for (const p of payments) {
    if (p.status !== "Paid") continue;
    paidByType[p.type] = (paidByType[p.type] || 0) + Number(p.amountPaid);
  }

  const items = c.room.isCarpark ? CARPARK_ONLY_ITEMS : BREAKDOWN_ITEMS;
  const breakdown = items.map((item) => {
    const dd = due[item] || 0;
    const pd = paidByType[item] || 0;
    return { item, due: dd, paid: pd, outstanding: Math.max(dd - pd, 0) };
  });

  const totalDue = Number(c.totalOutstanding);
  const totalPaid = payments.filter((p) => p.status === "Paid").reduce((s, p) => s + Number(p.amountPaid), 0);

  // "Owing" must reflect everything the tenant still has to pay right now — not just the
  // move-in lump sum (c.totalOutstanding), which never grows as later recurring bills
  // (rent/carpark/utilities for new months) get issued. So it's the still-unbilled remainder
  // of the move-in breakdown (skipping any item that already has its own open bill below, to
  // avoid double-counting) plus every currently open (PENDING/REJECTED) bill's amountDue —
  // PENDING_REVIEW is excluded since the tenant has already paid and is just awaiting approval.
  const openBillTypes = new Set(
    payments.filter((p) => p.status === "PENDING" || p.status === "REJECTED").map((p) => p.type)
  );
  const unbilledBreakdownTotal = breakdown
    .filter((b) => b.outstanding > 0 && !openBillTypes.has(b.item))
    .reduce((s, b) => s + b.outstanding, 0);
  const openBillsTotal = payments
    .filter((p) => p.status === "PENDING" || p.status === "REJECTED")
    .reduce((s, p) => s + Number(p.amountDue), 0);

  const { agent, ...contractRest } = c;
  return NextResponse.json({
    success: true,
    contract: serialize({ ...contractRest, agentIc: agent.ic }),
    payments: serialize(payments),
    breakdown,
    totalDue,
    totalPaid,
    totalOutstanding: unbilledBreakdownTotal + openBillsTotal,
  });
}

const addSchema = z
  .object({
    type: z.enum(["DEPOSIT", "UTILITIES", "RENTAL", "ADMIN_FEE", "ACCESS_CARD", "CARPARK", "AC", "DRYER", "ELECTRIC", "LATE_FEE", "OTHER"]),
    amountPaid: z.coerce.number(),
    amountDue: z.coerce.number().optional().default(0),
    periodMonth: z.string().trim().optional().default(""),
    dueDate: z.string().trim().optional(),
    paidDate: z.string().trim().optional(),
    method: z.string().trim().optional().default(""),
    notes: z.string().trim().optional().default(""),
    customLabel: z.string().trim().optional().default(""),
  })
  .refine((d) => d.type !== "OTHER" || d.customLabel, { message: "「其他」类型要填费用名称" });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ contractId: string }> }
) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "AGENT")) {
    return NextResponse.json({ success: false, message: "只有 Admin 或负责的 Agent 可以记收款" }, { status: 403 });
  }
  const { contractId } = await params;
  const c = await prisma.contract.findUnique({ where: { contractCode: contractId } });
  if (!c) return NextResponse.json({ success: false, message: "找不到合同" }, { status: 404 });
  if (user.role === "AGENT" && c.agentId !== user.sub) {
    return NextResponse.json({ success: false, message: "只能帮自己负责的合同记收款" }, { status: 403 });
  }

  const parsed = addSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message || "请填金额";
    return NextResponse.json({ success: false, message: msg }, { status: 400 });
  }
  const d = parsed.data;

  await prisma.payment.create({
    data: {
      paymentCode: await newId("PY"),
      contractId: c.id,
      roomCode: (await prisma.room.findUnique({ where: { id: c.roomId } }))!.roomCode,
      tenantId: c.tenantId,
      tenantName: c.tenantName,
      periodMonth: d.periodMonth,
      type: d.type,
      amountDue: d.amountDue,
      amountPaid: d.amountPaid,
      dueDate: d.dueDate ? new Date(d.dueDate) : null,
      paidDate: d.paidDate ? new Date(d.paidDate) : new Date(),
      status: "Paid",
      method: d.method,
      recordedBy: user.name,
      notes: d.notes,
      customLabel: d.type === "OTHER" ? d.customLabel : null,
    },
  });

  const label = d.type === "OTHER" ? d.customLabel : d.type;
  return NextResponse.json({ success: true, message: `✅ 已记一笔: ${label} RM${d.amountPaid.toFixed(2)}` });
}
