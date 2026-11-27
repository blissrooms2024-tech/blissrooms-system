import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { COMPANY, COMPANY_AUTO_SIGNATURE } from "@/lib/config";
import { withActivity } from "@/lib/activity";

/** One-time (idempotent) backfill for contracts created before Admin-self-created contracts
 * started using COMPANY.NAME as the "Agent" — those still show whichever Admin happened to
 * open them (e.g. "Admin (Quick Access)") instead of the company, and if still sitting in
 * PENDING_SIGN they're stuck waiting on an "Agent signature" that was never going to happen
 * (no real external Agent to sign it). Finds every contract whose assigned agent isn't an
 * actual AGENT-role user (the only way to be assigned one through the normal contract form is
 * to pick from that role's list — anything else means Admin opened it directly) and isn't
 * already fixed, renames it to COMPANY.NAME, and auto-completes the Agent-sign step the same
 * way /approve and /renew do going forward if it's still waiting on it. */
async function handlePOST() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ success: false, message: "只有 Admin 可以执行" }, { status: 403 });
  }

  const contracts = await prisma.contract.findMany({
    where: { agentName: { not: COMPANY.NAME } },
    include: { agent: { select: { role: true } } },
  });
  // A renewal is always company-signed, no matter who the carried-over agentId actually belongs
  // to (even a real AGENT-role user) — Admin processes renewals directly, not the original
  // referring Agent, who already earned their commission on the first signing. Older renewals
  // created before that rule was unconditional can still be sitting stuck on a real Agent's
  // signature that was never going to happen, same symptom as a fresh Admin-opened contract.
  const toFix = contracts.filter((c) => c.agent.role !== "AGENT" || !!c.renewedFromContractId);

  let renamed = 0;
  let unblocked = 0;
  for (const c of toFix) {
    const needsUnblock = c.status === "PENDING_SIGN" && !c.agentSignature;
    await prisma.contract.update({
      where: { id: c.id },
      data: {
        agentName: COMPANY.NAME,
        ...(needsUnblock ? { agentSignature: COMPANY_AUTO_SIGNATURE, agentSignDate: new Date() } : {}),
      },
    });
    renamed++;
    if (needsUnblock) unblocked++;
  }

  return NextResponse.json({
    success: true,
    message: `✅ 已修复 ${renamed} 张合同的 Agent 显示为「${COMPANY.NAME}」${unblocked > 0 ? `，其中 ${unblocked} 张卡在等 Agent 签名的已自动解除` : ""}`,
    renamed,
    unblocked,
  });
}

export const POST = withActivity(handlePOST);
