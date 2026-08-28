"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useToast } from "@/components/Toast";
import Lightbox from "@/components/Lightbox";
import { PAYMENT_TYPE_LABELS, paymentTypeLabel } from "@/lib/config";

interface PendingPayment {
  id: string;
  paymentCode: string;
  contractCode: string;
  roomCode: string;
  tenantName: string | null;
  type: string;
  amountDue: number;
  amountPaid: number;
  periodMonth: string | null;
  dueDate: string | null;
  paidDate: string | null;
  receiptLink: string | null;
  notes: string | null;
  customLabel: string | null;
}

function fmt(v: number) {
  return v || v === 0 ? `RM${Number(v).toLocaleString()}` : "-";
}
function fmtDate(v: string | null) {
  return v ? v.slice(0, 10) : "-";
}

export default function ReviewQueueClient({ canAct }: { canAct: boolean }) {
  const toast = useToast();
  const [items, setItems] = useState<PendingPayment[] | null>(null);
  const [error, setError] = useState("");
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/payments/pending-review");
      const data = await res.json();
      if (!data.success) {
        setError(data.message);
        return;
      }
      setItems(data.payments);
    } catch {
      setError("出错，请稍后再试");
    }
  }, []);

  useEffect(() => {
    // setState happens after the fetch's await, not synchronously in the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function approve(id: string) {
    const res = await fetch(`/api/payments/${id}/approve`, { method: "POST" });
    const data = await res.json();
    if (data.success) toast.success(data.message);
    else toast.danger(data.message);
    load();
  }

  async function reject(id: string) {
    if (!rejectReason.trim()) {
      toast.warning("请填拒绝原因");
      return;
    }
    const res = await fetch(`/api/payments/${id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: rejectReason.trim() }),
    });
    const data = await res.json();
    if (data.success) toast.success(data.message);
    else toast.danger(data.message);
    setRejectingId(null);
    setRejectReason("");
    load();
  }

  const typeOptions = items ? [...new Set(items.map((p) => p.type))] : [];
  const q = search.trim().toLowerCase();
  const filteredItems =
    items?.filter((p) => {
      if (typeFilter && p.type !== typeFilter) return false;
      if (!q) return true;
      return (
        p.contractCode.toLowerCase().includes(q) ||
        p.roomCode.toLowerCase().includes(q) ||
        (p.tenantName ?? "").toLowerCase().includes(q)
      );
    }) ?? null;

  return (
    <div className="rounded-xl bg-white p-5 shadow-sm">
      <h3 className="mb-3.5 text-base font-semibold text-brand">🧾 水单审核队列</h3>
      {error && <div className="text-sm text-red-600">{error}</div>}
      {!items && !error && <div className="text-sm text-gray-500">载入中...</div>}
      {items && items.length === 0 && (
        <div className="py-8 text-center text-gray-400">🎉 没有待审核的水单</div>
      )}
      {items && items.length > 0 && (
        <>
          <div className="mb-3.5 flex flex-wrap gap-2.5">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索合同号 / 房间 / 租客姓名"
              className="input max-w-[220px] flex-1"
            />
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="input max-w-[160px]">
              <option value="">全部项目</option>
              {typeOptions.map((t) => (
                <option key={t} value={t}>
                  {PAYMENT_TYPE_LABELS[t] ?? t}
                </option>
              ))}
            </select>
          </div>
          {filteredItems && filteredItems.length === 0 && (
            <div className="py-8 text-center text-gray-400">没有符合条件的水单</div>
          )}
        </>
      )}
      {filteredItems && filteredItems.length > 0 && (
        <div className="space-y-3">
          {filteredItems.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 p-3.5">
              {p.receiptLink && (
                <button type="button" onClick={() => setZoomUrl(p.receiptLink)} className="shrink-0 cursor-zoom-in">
                  <img
                    src={p.receiptLink}
                    alt="水单"
                    className="h-[70px] w-[70px] rounded border border-gray-300 object-cover hover:opacity-90"
                  />
                </button>
              )}
              <div className="min-w-[220px] flex-1">
                <div className="text-sm font-semibold">
                  <Link href={`/contracts`} className="text-brand hover:underline">
                    {p.contractCode}
                  </Link>{" "}
                  · {p.roomCode} · {p.tenantName}
                </div>
                <div className="text-sm text-gray-600">
                  {paymentTypeLabel(p.type, p.customLabel)} · {fmt(p.amountPaid)}
                  {p.periodMonth ? ` · ${p.periodMonth}` : ""} · 到期 {fmtDate(p.dueDate)} · 上传于 {fmtDate(p.paidDate)}
                </div>
                {p.type === "AC" && (
                  <div className="mt-1 text-xs font-semibold text-amber-700">
                    ❄️ 冷气充值：批准后请在12小时内更新到 Smart Meter (只在周一至五, 六日/公共假期不处理)
                  </div>
                )}
              </div>
              {canAct && (
                <div className="shrink-0">
                  {rejectingId === p.id ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        className="input w-[160px] text-xs"
                        placeholder="拒绝原因"
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                      />
                      <button
                        onClick={() => reject(p.id)}
                        className="rounded-md bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white"
                      >
                        确定拒绝
                      </button>
                      <button
                        onClick={() => {
                          setRejectingId(null);
                          setRejectReason("");
                        }}
                        className="rounded-md bg-gray-100 px-2.5 py-1.5 text-xs text-gray-600"
                      >
                        取消
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => approve(p.id)}
                        className="rounded-md bg-green-700 px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        ✅ 批准
                      </button>
                      <button
                        onClick={() => setRejectingId(p.id)}
                        className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        ✗ 拒绝
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {zoomUrl && <Lightbox src={zoomUrl} alt="水单" onClose={() => setZoomUrl(null)} />}
    </div>
  );
}
