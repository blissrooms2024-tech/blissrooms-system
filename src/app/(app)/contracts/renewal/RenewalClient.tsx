"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useToast } from "@/components/Toast";
import ConfirmDialog from "@/components/ConfirmDialog";
import { fmtDate } from "@/lib/format";
import { FEES } from "@/lib/config";

interface Candidate {
  contractCode: string;
  tenantName: string;
  roomCode: string;
  agentName: string;
  expiredDate: string | null;
  daysToExpiry: number | null;
}

function addMonths(dateStr: string | null, months: number) {
  const d = dateStr ? new Date(dateStr) : new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

export default function RenewalClient() {
  const toast = useToast();
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [newDate, setNewDate] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/contracts/renewal-candidates");
      const data = await res.json();
      if (!data.success) {
        setError(data.message);
        return;
      }
      setCandidates(data.contracts);
    } catch {
      setError("出错，请稍后再试");
    }
  }, []);

  useEffect(() => {
    // setState happens after the fetch's await, not synchronously in the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  function openRow(c: Candidate) {
    setOpenId(c.contractCode);
    setNewDate(addMonths(c.expiredDate, 12));
  }

  async function confirmRenew() {
    if (!openId) return;
    setConfirming(false);
    setSaving(true);
    try {
      const res = await fetch(`/api/contracts/${openId}/renew`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newExpiredDate: newDate }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setOpenId(null);
        load();
      } else {
        toast.danger(data.message);
      }
    } catch {
      toast.danger("系统出错，请稍后再试");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="rounded-xl bg-white p-5 shadow-sm">
        <div className="mb-3.5 flex items-center justify-between">
          <h3 className="text-base font-semibold text-brand">🔄 续约管理</h3>
          <Link href="/contracts" className="text-sm text-gray-500 hover:underline">
            ← 返回合同清单
          </Link>
        </div>
        <div className="mb-3.5 rounded-lg bg-brand-light/40 p-3.5 text-sm text-gray-600">
          这里列出快到期 (提前 2 个月内) 或已经到期的生效中合同。租客要续约的话请他们直接联系 Admin，
          确认后在这里帮他们改新的到期日，系统会自动开一笔 RM{FEES.RENEWAL} 续约行政费账单给租客上传交易单。
        </div>

        {error && <div className="text-sm text-red-600">{error}</div>}
        {!candidates && !error && <div className="text-sm text-gray-500">载入中...</div>}
        {candidates && candidates.length === 0 && (
          <div className="py-6 text-center text-sm text-gray-400">目前没有快到期或已到期的合同</div>
        )}

        {candidates && candidates.length > 0 && (
          <div className="space-y-2.5">
            {candidates.map((c) => (
              <div key={c.contractCode} className="rounded-lg border border-gray-200 p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <div>
                    <Link href={`/contracts/${c.contractCode}`} className="font-semibold text-brand hover:underline">
                      {c.contractCode}
                    </Link>{" "}
                    · {c.tenantName} · {c.roomCode} · {c.agentName}
                    <div className="text-xs text-gray-500">
                      到期日: {fmtDate(c.expiredDate)}{" "}
                      {c.daysToExpiry !== null && c.daysToExpiry < 0 ? (
                        <span className="font-semibold text-red-600">(已过期 {Math.abs(c.daysToExpiry)} 天)</span>
                      ) : (
                        <span className="font-semibold text-amber-600">(还剩 {c.daysToExpiry} 天)</span>
                      )}
                    </div>
                  </div>
                  {openId !== c.contractCode && (
                    <button onClick={() => openRow(c)} className="btn-primary text-sm">
                      🔄 续约
                    </button>
                  )}
                </div>

                {openId === c.contractCode && (
                  <div className="mt-3 flex flex-wrap items-end gap-2.5 border-t border-gray-100 pt-3">
                    <div>
                      <label className="mb-1.5 block text-sm text-gray-600">新到期日</label>
                      <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="input" />
                    </div>
                    <button onClick={() => setConfirming(true)} disabled={saving} className="btn-primary text-sm">
                      {saving ? "处理中..." : `确认续约 (开 RM${FEES.RENEWAL} 行政费)`}
                    </button>
                    <button onClick={() => setOpenId(null)} className="btn-soft text-sm">
                      取消
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirming}
        message={`确定把 ${openId} 续约到 ${newDate}？会自动开一笔 RM${FEES.RENEWAL} 续约行政费账单给租客。`}
        confirmLabel="确定续约"
        onConfirm={confirmRenew}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
