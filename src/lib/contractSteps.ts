import type { TimelineStep } from "@/components/StepTimeline";

export interface ContractStepInput {
  status: string;
  agentSigned: boolean;
  tenantSigned: boolean;
  icDone: boolean;
  moveInDone: boolean;
  outstanding: number;
  isLegacy: boolean;
}

function money(v: number) {
  return `RM${v.toLocaleString()}`;
}

/** Shared 合同+付款 progress steps for the tenant/agent/admin contract views — same idea as the
 * maintenance request flow, so everyone sees the same pipeline and can tell who's holding up
 * the next step. */
export function buildContractSteps(c: ContractStepInput): TimelineStep[] {
  if (c.isLegacy) {
    return [
      { label: "旧合同 (纸本已签)", state: "done" },
      {
        label: c.outstanding > 0 ? `开办费/押金 (还欠 ${money(c.outstanding)})` : "开办费/押金已收清",
        state: c.outstanding > 0 ? "active" : "done",
      },
      { label: "Move-in 表格", state: c.moveInDone ? "done" : "active" },
    ];
  }

  const approved = !["DRAFT", "PENDING_APPROVE"].includes(c.status);

  return [
    { label: "合同已开", state: "done" },
    { label: "Admin 批准", state: approved ? "done" : c.status === "PENDING_APPROVE" ? "active" : "pending" },
    { label: "Agent 签名", state: c.agentSigned ? "done" : approved ? "active" : "pending" },
    { label: "Tenant 上传 IC", state: c.icDone ? "done" : c.agentSigned ? "active" : "pending" },
    {
      label: "Tenant 签名",
      state: c.tenantSigned ? "done" : c.agentSigned && c.icDone ? "active" : "pending",
    },
    {
      label: c.outstanding > 0 ? `开办费/押金 (还欠 ${money(c.outstanding)})` : "开办费/押金已收清",
      state: c.outstanding > 0 ? (c.tenantSigned ? "active" : "pending") : "done",
    },
    { label: "Move-in 表格", state: c.moveInDone ? "done" : c.tenantSigned ? "active" : "pending" },
  ];
}
