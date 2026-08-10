"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { CONTRACT_STATUS_LABELS } from "@/lib/config";
import SignatureModal from "../contracts/SignatureModal";
import ICUploadModal from "../contracts/ICUploadModal";
import MoveFormModal from "../contracts/MoveFormModal";

interface Card {
  contractCode: string;
  roomCode: string;
  status: string;
  totalOutstanding: number;
  paid: number;
  outstanding: number;
  agentSigned: boolean;
  tenantSigned: boolean;
  hasICFront: boolean;
  hasICBack: boolean;
  moveInDone: boolean;
  moveOutDone: boolean;
  daysToExpiry: number | null;
}

function Pill({ tone, children }: { tone: "done" | "wait" | "lock" | "due"; children: React.ReactNode }) {
  const cls: Record<string, string> = {
    done: "bg-green-50 text-green-700",
    wait: "bg-yellow-50 text-yellow-800",
    lock: "bg-gray-100 text-gray-500",
    due: "bg-red-50 text-red-700",
  };
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${cls[tone]}`}>{children}</span>;
}

export default function MyTenancyClient() {
  const [cards, setCards] = useState<Card[] | null>(null);
  const [error, setError] = useState("");
  const [signing, setSigning] = useState<string | null>(null);
  const [icUploading, setIcUploading] = useState<string | null>(null);
  const [moveForm, setMoveForm] = useState<{ code: string; type: "MoveIn" | "MoveOut" } | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/contracts/my-cards");
      const data = await res.json();
      if (!data.success) return setError(data.message);
      setCards(data.cards);
    } catch {
      setError("出错，请稍后再试");
    }
  }, []);

  useEffect(() => {
    // setState happens after the fetch's await, not synchronously in the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  if (error) return <div className="rounded-xl bg-white p-5 text-sm text-red-600 shadow-sm">{error}</div>;
  if (!cards) return <div className="rounded-xl bg-white p-5 text-sm text-gray-500 shadow-sm">载入中...</div>;
  if (cards.length === 0) {
    return <div className="rounded-xl bg-white p-5 text-center text-gray-400 shadow-sm">你还没有租约</div>;
  }

  return (
    <div className="space-y-5">
      {cards.map((c) => {
        const icDone = c.hasICFront && c.hasICBack;
        const canSign = c.agentSigned && icDone && !c.tenantSigned;

        return (
          <div key={c.contractCode} className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 bg-gradient-to-br from-brand to-blue-600 px-5 py-4 text-white">
              <div>
                <div className="text-lg font-bold">{c.contractCode}</div>
                <div className="text-sm opacity-90">🏠 {c.roomCode}</div>
              </div>
              <div className="rounded-full bg-white/20 px-3.5 py-1 text-xs font-semibold">
                {CONTRACT_STATUS_LABELS[c.status] ?? c.status}
              </div>
            </div>

            <div className="px-5 py-1">
              <Row
                icon="📄"
                name="合同 Agreement"
                desc="查看完整合同与条款"
                status={<Pill tone={c.status === "ACTIVE" ? "done" : "wait"}>{CONTRACT_STATUS_LABELS[c.status]}</Pill>}
                action={
                  <Link href={`/agreement/${c.contractCode}`} className="btn-soft px-3.5 py-1.5 text-xs">
                    查看合同
                  </Link>
                }
              />

              <Row
                icon="✍️"
                name="合同签名 Signature"
                status={
                  c.tenantSigned ? (
                    <Pill tone="done">✅ 已签</Pill>
                  ) : !c.agentSigned ? (
                    <Pill tone="lock">🔒 等 Agent 先签</Pill>
                  ) : !icDone ? (
                    <Pill tone="wait">⚠️ 先上传 IC</Pill>
                  ) : (
                    <Pill tone="wait">待签名</Pill>
                  )
                }
                action={
                  canSign && (
                    <button onClick={() => setSigning(c.contractCode)} className="btn-primary px-3.5 py-1.5 text-xs">
                      签名
                    </button>
                  )
                }
              />

              <Row
                icon="🪪"
                name="IC / 护照"
                desc="正反面副本"
                status={
                  icDone ? (
                    <Pill tone="done">✅ 已上传</Pill>
                  ) : c.hasICFront || c.hasICBack ? (
                    <Pill tone="wait">⚠️ 差一面</Pill>
                  ) : (
                    <Pill tone="wait">⚠️ 未上传</Pill>
                  )
                }
                action={
                  <button onClick={() => setIcUploading(c.contractCode)} className="btn-soft px-3.5 py-1.5 text-xs">
                    {icDone ? "查看" : "上传"}
                  </button>
                }
              />

              <Row
                icon="📋"
                name="Move-in 表单"
                desc="搬入房间物品记录"
                status={
                  c.status !== "ACTIVE" ? (
                    <Pill tone="lock">🔒 合同生效后开放</Pill>
                  ) : c.moveInDone ? (
                    <Pill tone="done">✅ 已填</Pill>
                  ) : (
                    <Pill tone="wait">⚠️ 未填</Pill>
                  )
                }
                action={
                  c.status === "ACTIVE" && (
                    <button
                      onClick={() => setMoveForm({ code: c.contractCode, type: "MoveIn" })}
                      className={c.moveInDone ? "btn-soft px-3.5 py-1.5 text-xs" : "btn-primary px-3.5 py-1.5 text-xs"}
                    >
                      {c.moveInDone ? "查看/修改" : "填写"}
                    </button>
                  )
                }
              />

              {(() => {
                // No expiredDate set -> treat like the original's 999-day fallback: not open yet.
                const withinWindow = c.daysToExpiry !== null && c.daysToExpiry <= 14;
                return (
                  <Row
                    icon="📦"
                    name="Move-out 表单"
                    desc="搬出房间状况记录"
                    status={
                      c.status !== "ACTIVE" ? (
                        <Pill tone="lock">🔒 未开放</Pill>
                      ) : !withinWindow ? (
                        <Pill tone="lock">
                          🔒 到期前2周开放{c.daysToExpiry !== null ? ` (还有${c.daysToExpiry}天)` : ""}
                        </Pill>
                      ) : c.moveOutDone ? (
                        <Pill tone="done">✅ 已填</Pill>
                      ) : (
                        <Pill tone="wait">⚠️ 可以填了</Pill>
                      )
                    }
                    action={
                      c.status === "ACTIVE" &&
                      withinWindow && (
                        <button
                          onClick={() => setMoveForm({ code: c.contractCode, type: "MoveOut" })}
                          className={c.moveOutDone ? "btn-soft px-3.5 py-1.5 text-xs" : "btn-primary px-3.5 py-1.5 text-xs"}
                        >
                          {c.moveOutDone ? "查看" : "填写"}
                        </button>
                      )
                    }
                  />
                );
              })()}

              <Row
                icon="💰"
                name="租金 Outstanding"
                desc={`总款 RM${c.totalOutstanding.toLocaleString()} · 已收 RM${c.paid.toLocaleString()}`}
                status={
                  c.outstanding > 0 ? (
                    <Pill tone="due">RM{c.outstanding.toLocaleString()} 未清</Pill>
                  ) : (
                    <Pill tone="done">✅ 已清</Pill>
                  )
                }
              />
            </div>
          </div>
        );
      })}

      {signing && (
        <SignatureModal contractCode={signing} who="tenant" onClose={() => setSigning(null)} onSigned={load} />
      )}
      {icUploading && (
        <ICUploadModal contractCode={icUploading} onClose={() => setIcUploading(null)} onUploaded={load} />
      )}
      {moveForm && (
        <MoveFormModal
          contractCode={moveForm.code}
          type={moveForm.type}
          onClose={() => setMoveForm(null)}
          onSubmitted={load}
        />
      )}
    </div>
  );
}

function Row({
  icon,
  name,
  desc,
  status,
  action,
}: {
  icon: string;
  name: string;
  desc?: string;
  status: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-50 py-3.5 last:border-none">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-light text-lg">
          {icon}
        </div>
        <div>
          <div className="text-sm font-semibold text-gray-800">{name}</div>
          {desc && <div className="text-xs text-gray-400">{desc}</div>}
        </div>
      </div>
      <div className="flex items-center gap-2.5">
        {status}
        {action}
      </div>
    </div>
  );
}
