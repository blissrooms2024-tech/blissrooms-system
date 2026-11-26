import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { COMPANY, COMPANY_AUTO_SIGNATURE } from "@/lib/config";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ contractId: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ success: false, message: "只有 Admin 可以批" }, { status: 403 });
  }
  const { contractId } = await params;
  const contract = await prisma.contract.findUnique({
    where: { contractCode: contractId },
    include: { agent: { select: { role: true } } },
  });
  if (!contract) return NextResponse.json({ success: false, message: "找不到合同" }, { status: 404 });
  if (contract.status !== "PENDING_APPROVE") {
    return NextResponse.json({ success: false, message: "这合同不在等批状态" }, { status: 409 });
  }

  // The company itself is the "Agent" on this contract — detected by the assigned agent's
  // actual role, not by whatever agentName happens to already say, so this works even for a
  // contract whose agentName hasn't been through the 补正公司 Agent backfill yet. Admin opened
  // it directly with no one entitled to commission, so there's no one to actually sign that
  // step — it's marked done automatically right here instead of leaving the flow stuck.
  const isCompanyAgent = contract.agent.role !== "AGENT";

  await prisma.contract.update({
    where: { contractCode: contractId },
    data: {
      status: "PENDING_SIGN",
      approvedBy: user.name,
      approvedAt: new Date(),
      ...(isCompanyAgent ? { agentName: COMPANY.NAME, agentSignature: COMPANY_AUTO_SIGNATURE, agentSignDate: new Date() } : {}),
    },
  });

  return NextResponse.json({
    success: true,
    message: isCompanyAgent ? "✅ 已批准, Agent 是公司本身, 已自动完成, 现在等租客签名" : "✅ 已批准, 现在可以签名了",
  });
}
