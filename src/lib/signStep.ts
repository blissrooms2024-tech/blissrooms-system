/**
 * Where a contract that isn't live yet is stuck, in the order the steps have to happen:
 * Admin approves → Agent signs (renewals are company-signed automatically) → tenant uploads
 * both sides of their IC → tenant signs, which makes it ACTIVE. Shared by the home page's
 * 待签合同 list and the contract cards so both name the same step.
 */
export type SignStep = "APPROVE" | "AGENT_SIGN" | "TENANT_IC" | "TENANT_SIGN";

export function signStepOf(c: {
  status: string;
  agentSignature: string | null;
  icFront?: string | null;
  icBack?: string | null;
}): SignStep | null {
  if (c.status === "PENDING_APPROVE") return "APPROVE";
  if (c.status !== "PENDING_SIGN") return null;
  if (!c.agentSignature) return "AGENT_SIGN";
  if (!c.icFront || !c.icBack) return "TENANT_IC";
  return "TENANT_SIGN";
}

/** Waiting on Admin is violet (Admin's own queue); every signature step is red, like 等签名. */
export const SIGN_STEP_TONE: Record<SignStep, "violet" | "rose"> = {
  APPROVE: "violet",
  AGENT_SIGN: "rose",
  TENANT_IC: "rose",
  TENANT_SIGN: "rose",
};

export const SIGN_STEP_LABELS: Record<SignStep, { zh: string; en: string }> = {
  APPROVE: { zh: "等 Admin 批准", en: "Admin to approve" },
  AGENT_SIGN: { zh: "等 Agent 签名", en: "Agent to sign" },
  TENANT_IC: { zh: "等租客上传 IC", en: "Tenant to upload IC" },
  TENANT_SIGN: { zh: "等租客签名", en: "Tenant to sign" },
};
