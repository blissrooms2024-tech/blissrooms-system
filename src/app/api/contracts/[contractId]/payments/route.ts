import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, type SessionPayload } from "@/lib/auth/session";
import { serialize } from "@/lib/serialize";
import { newId } from "@/lib/id";

function canView(user: SessionPayload, contract: { agentId: string; tenantId: string | null }) {
  if (user.role === "BOSS" || user.role === "ADMIN") return true;
  if (user.role === "AGENT" && contract.agentId === user.sub) return true;
  if (user.role === "TENANT" && contract.tenantId === user.sub) return true;
  return false;
}

const BREAKDOWN_ITEMS = ["DEPOSIT", "UTILITIES", "ADMIN_FEE", "ACCESS_CARD", "RENTAL"] as const;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ contractId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ success: false, message: "请重新登录" }, { status: 401 });

  const { contractId } = await params;
  const c = await prisma.contract.findUnique({
    where: { contractCode: contractId },
    include: { agent: true },
  });
  if (!c) return NextResponse.json({ success: false, message: "找不到合同" }, { status: 404 });
  if (!canView(user, c)) {
    return NextResponse.json({ success: false, message: "没有权限查看这张合同" }, { status: 403 });
  }

  const payments = await prisma.payment.findMany({
    where: { contractId: c.id },
    orderBy: { id: "desc" },
  });

  const due: Record<string, number> = {
    DEPOSIT: Number(c.securityDeposit),
    UTILITIES: Number(c.utilitiesDeposit),
    ADMIN_FEE: Number(c.adminFee),
    ACCESS_CARD: Number(c.accessCardDeposit),
    RENTAL: Number(c.roomRental),
  };
  const paidByType: Record<string, number> = {};
  for (const p of payments) {
    paidByType[p.type] = (paidByType[p.type] || 0) + Number(p.amountPaid);
  }

  const breakdown = BREAKDOWN_ITEMS.map((item) => {
    const dd = due[item] || 0;
    const pd = paidByType[item] || 0;
    return { item, due: dd, paid: pd, outstanding: Math.max(dd - pd, 0) };
  });

  const totalDue = Number(c.totalOutstanding);
  const totalPaid = payments.reduce((s, p) => s + Number(p.amountPaid), 0);

  return NextResponse.json({
    success: true,
    contract: serialize({ ...c, agentIc: c.agent.ic }),
    payments: serialize(payments),
    breakdown,
    totalDue,
    totalPaid,
    totalOutstanding: Math.max(totalDue - totalPaid, 0),
  });
}

const addSchema = z.object({
  type: z.enum(["DEPOSIT", "UTILITIES", "RENTAL", "ADMIN_FEE", "ACCESS_CARD", "AC", "LATE_FEE", "OTHER"]),
  amountPaid: z.coerce.number(),
  amountDue: z.coerce.number().optional().default(0),
  periodMonth: z.string().trim().optional().default(""),
  dueDate: z.string().trim().optional(),
  paidDate: z.string().trim().optional(),
  method: z.string().trim().optional().default(""),
  notes: z.string().trim().optional().default(""),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ contractId: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ success: false, message: "只有 Admin 可以记收款" }, { status: 403 });
  }
  const { contractId } = await params;
  const c = await prisma.contract.findUnique({ where: { contractCode: contractId } });
  if (!c) return NextResponse.json({ success: false, message: "找不到合同" }, { status: 404 });

  const parsed = addSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "请填金额" }, { status: 400 });
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
    },
  });

  return NextResponse.json({ success: true, message: `✅ 已记一笔: ${d.type} RM${d.amountPaid}` });
}
