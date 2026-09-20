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

export interface NextAction {
  who: "Admin" | "Agent" | "Tenant";
  text: string;
}

interface StepDef extends TimelineStep {
  who?: NextAction["who"];
  action?: string;
}

function money(v: number) {
  return `RM${v.toLocaleString()}`;
}

/** Shared 合同+付款 progress for the tenant/agent/admin contract views — same idea as the
 * maintenance request flow, so everyone sees the same pipeline. `nextAction` names exactly
 * who's holding things up and what they need to do, so it doesn't require reading the whole
 * timeline to figure out — that ambiguity was the actual complaint (tenant/agent not knowing
 * the next step and asking Admin every time). */
export function buildContractSteps(c: ContractStepInput): { steps: TimelineStep[]; nextAction: NextAction | null } {
  let defs: StepDef[];

  if (c.isLegacy) {
    // Legacy-imported contracts skip signing and the move-in form entirely (already recorded
    // on paper / the old Google Form before import) — only the initial deposit can still be
    // outstanding.
    defs = [
      { label: "旧合同 (纸本已签)", state: "done" },
      {
        label: c.outstanding > 0 ? `还欠 ${money(c.outstanding)}` : "已清",
        state: c.outstanding > 0 ? "active" : "done",
        who: "Tenant",
        action: `请缴清还欠款项 ${money(c.outstanding)}`,
      },
    ];
  } else {
    const approved = !["DRAFT", "PENDING_APPROVE"].includes(c.status);
    defs = [
      { label: "合同已开", state: "done" },
      {
        label: "Admin 批准",
        state: approved ? "done" : c.status === "PENDING_APPROVE" ? "active" : "pending",
        who: "Admin",
        action: "请批准这张合同",
      },
      {
        label: "Agent 签名",
        state: c.agentSigned ? "done" : approved ? "active" : "pending",
        who: "Agent",
        action: "请签名",
      },
      {
        label: "Tenant 上传 IC",
        state: c.icDone ? "done" : c.agentSigned ? "active" : "pending",
        who: "Tenant",
        action: "请上传 IC 正反面照片",
      },
      {
        label: "Tenant 签名",
        state: c.tenantSigned ? "done" : c.agentSigned && c.icDone ? "active" : "pending",
        who: "Tenant",
        action: "请签名",
      },
      {
        label: c.outstanding > 0 ? `还欠 ${money(c.outstanding)}` : "已清",
        state: c.outstanding > 0 ? (c.tenantSigned ? "active" : "pending") : "done",
        who: "Tenant",
        action: `请缴清还欠款项 ${money(c.outstanding)}`,
      },
      {
        label: "Move-in 表格",
        state: c.moveInDone ? "done" : c.tenantSigned ? "active" : "pending",
        who: "Tenant",
        action: "请填写 Move-in 表格",
      },
    ];
  }

  const active = defs.find((d) => d.state === "active");
  const nextAction: NextAction | null = active?.who ? { who: active.who, text: active.action ?? active.label } : null;
  const steps: TimelineStep[] = defs.map((d) => ({ label: d.label, state: d.state, sublabel: d.sublabel }));

  return { steps, nextAction };
}
