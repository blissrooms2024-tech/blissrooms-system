import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";

/** Formal monthly payslip for an Agent's paid commissions — grouped by the month each
 * commission was marked Paid (Contract.commPaidAt), since that's the actual payout event. */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "AGENT") {
    return NextResponse.json({ success: false, message: "只有 Agent 可以看" }, { status: 403 });
  }

  const paidContracts = await prisma.contract.findMany({
    where: { agentId: user.sub, commStatus: "Paid", commAmount: { not: null }, commPaidAt: { not: null } },
    select: { contractCode: true, tenantName: true, commAmount: true, commPaidAt: true },
    orderBy: { commPaidAt: "desc" },
  });

  const months = [...new Set(paidContracts.map((c) => c.commPaidAt!.toISOString().slice(0, 7)))];

  const url = new URL(req.url);
  const month = url.searchParams.get("month") || months[0] || new Date().toISOString().slice(0, 7);

  const lines = paidContracts
    .filter((c) => c.commPaidAt!.toISOString().slice(0, 7) === month)
    .map((c) => ({
      label: `Referral Commission — Contract ${c.contractCode} (${c.tenantName})`,
      amount: Number(c.commAmount),
    }));

  const me = await prisma.user.findUnique({
    where: { id: user.sub },
    select: { name: true, userCode: true, ic: true, bankName: true, bankAccountNumber: true },
  });

  return NextResponse.json({
    success: true,
    months,
    month,
    agent: me,
    lines,
  });
}
