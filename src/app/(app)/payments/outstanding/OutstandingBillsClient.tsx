"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { PAYMENT_TYPE_LABELS, paymentTypeLabel } from "@/lib/config";
import { fmtDate } from "@/lib/format";

interface Bill {
  id: string;
  paymentCode: string;
  contractCode: string;
  agentName: string;
  roomCode: string;
  tenantName: string | null;
  type: string;
  status: string;
  amountDue: number;
  amountPaid: number;
  periodMonth: string | null;
  dueDate: string | null;
  reviewNote: string | null;
  customLabel: string | null;
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "等租客上传", cls: "bg-gray-100 text-gray-600" },
  PENDING_REVIEW: { label: "待审核", cls: "bg-yellow-50 text-yellow-800" },
  REJECTED: { label: "已拒绝, 待重传", cls: "bg-red-50 text-red-700" },
};

function fmt(v: number) {
  return v || v === 0 ? `RM${Number(v).toLocaleString()}` : "-";
}

export default function OutstandingBillsClient() {
  const [items, setItems] = useState<Bill[] | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/payments/outstanding");
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  if (error) return <div className="rounded-xl bg-white p-5 text-sm text-red-600 shadow-sm">{error}</div>;
  if (!items) return <div className="rounded-xl bg-white p-5 text-sm text-gray-500 shadow-sm">载入中...</div>;

  const typeOptions = [...new Set(items.map((p) => p.type))];
  const today = new Date().toISOString().slice(0, 10);
  const q = search.trim().toLowerCase();
  const filtered = items.filter((p) => {
    if (typeFilter && p.type !== typeFilter) return false;
    if (statusFilter && p.status !== statusFilter) return false;
    if (!q) return true;
    return (
      p.contractCode.toLowerCase().includes(q) ||
      p.roomCode.toLowerCase().includes(q) ||
      (p.tenantName ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="rounded-xl bg-white p-5 shadow-sm">
      <h3 className="mb-3.5 text-base font-semibold text-brand">📋 未清账单 (全部未付)</h3>
      <p className="mb-3.5 text-xs text-gray-500">
        所有还没变成「已付」的账单 — 包括还在等租客上传交易单的，方便跟进催缴，不用一间一间合同去检查。
      </p>

      {items.length === 0 ? (
        <div className="py-8 text-center text-gray-400">🎉 没有未清账单</div>
      ) : (
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
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input max-w-[160px]">
              <option value="">全部状态</option>
              <option value="PENDING">等租客上传</option>
              <option value="PENDING_REVIEW">待审核</option>
              <option value="REJECTED">已拒绝, 待重传</option>
            </select>
          </div>

          {filtered.length === 0 ? (
            <div className="py-8 text-center text-gray-400">没有符合条件的账单</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-gray-600">
                  <th className="px-2.5 py-1.5 font-semibold">合同</th>
                  <th className="px-2.5 py-1.5 font-semibold">项目</th>
                  <th className="px-2.5 py-1.5 font-semibold">金额</th>
                  <th className="px-2.5 py-1.5 font-semibold">到期日</th>
                  <th className="px-2.5 py-1.5 font-semibold">状态</th>
                  <th className="px-2.5 py-1.5 font-semibold">Agent</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const badge = STATUS_BADGE[p.status] ?? { label: p.status, cls: "bg-gray-100 text-gray-600" };
                  const overdue = p.status === "PENDING" && p.dueDate && p.dueDate.slice(0, 10) < today;
                  return (
                    <tr key={p.id} className="border-b border-gray-100">
                      <td className="px-2.5 py-1.5">
                        <Link href={`/contracts/${p.contractCode}`} className="text-brand hover:underline">
                          {p.contractCode}
                        </Link>
                        <div className="text-xs text-gray-500">
                          {p.roomCode} · {p.tenantName}
                        </div>
                      </td>
                      <td className="px-2.5 py-1.5">
                        {paymentTypeLabel(p.type, p.customLabel)}
                        {p.periodMonth ? ` (${p.periodMonth})` : ""}
                      </td>
                      <td className="px-2.5 py-1.5 font-semibold">{fmt(p.amountDue)}</td>
                      <td className={`px-2.5 py-1.5 ${overdue ? "font-semibold text-red-600" : ""}`}>
                        {fmtDate(p.dueDate)}
                        {overdue ? " ⚠️逾期" : ""}
                      </td>
                      <td className="px-2.5 py-1.5">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-2.5 py-1.5 text-gray-600">{p.agentName}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
