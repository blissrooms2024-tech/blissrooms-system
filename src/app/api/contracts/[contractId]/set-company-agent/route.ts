import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { COMPANY, COMPANY_AUTO_SIGNATURE } from "@/lib/config";

/** Manual, per-contract version of the "🏢 补正公司 Agent 合同" backfill — for a contract the
 * backfill's own heuristics can't catch (e.g. it isn't linked via renewedFromContractId even
 * though Admin knows, from real-world context, that this lease is actually a renewal processed
 * as a fresh contract instead of through the in-app 续约 flow, with a real Agent picked by
 * mistake/habit). Admin explicitly says "this one's really the company, not that Agent" and this
 * reassigns it, same end state as the bulk backfill: agentName becomes the company's own name,
 * and if the Agent-sign step hasn't happened yet it's auto-completed right here. Blocked once a
 * REAL signature is already on file — by then the Agent genuinely signed as themself, so
 * rewriting who gets credited would misrepresent what actually happened; only commission still
 * Pending gets cleared (no one left to earn it), one already Paid is left untouched. */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ contractId: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ success: false, message: "只有 Admin 可以操作" }, { status: 403 });
  }
  const { contractId } = await params;
  const contract = await prisma.contract.findUnique({ where: { contractCode: contractId } });
  if (!contract) return NextResponse.json({ success: false, message: "找不到合同" }, { status: 404 });

  if (contract.agentName === COMPANY.NAME) {
    return NextResponse.json({ success: false, message: "这张合同的 Agent 已经是公司了" }, { status: 409 });
  }
  if (contract.agentSignature && contract.agentSignature !== COMPANY_AUTO_SIGNATURE) {
    return NextResponse.json(
      { success: false, message: "Agent 已经用真实签名签过这张合同了，不能再改成公司" },
      { status: 409 }
    );
  }

  const needsSign = (contract.status === "PENDING_SIGN" || contract.status === "ACTIVE") && !contract.agentSignature;

  await prisma.contract.update({
    where: { id: contract.id },
    data: {
      agentName: COMPANY.NAME,
      ...(needsSign ? { agentSignature: COMPANY_AUTO_SIGNATURE, agentSignDate: new Date() } : {}),
      ...(contract.commStatus !== "Paid" ? { commAmount: null, commStatus: "Pending", commPaidAt: null } : {}),
    },
  });

  return NextResponse.json({
    success: true,
    message: needsSign
      ? "✅ Agent 已换成公司, 已自动完成签名, 现在等 Tenant 签名"
      : "✅ Agent 已换成公司",
  });
}
