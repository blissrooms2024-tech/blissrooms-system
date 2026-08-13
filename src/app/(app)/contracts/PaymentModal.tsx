"use client";

import { useEffect, useState, useCallback } from "react";
import Modal from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { PAYMENT_TYPE_LABELS } from "@/lib/config";

interface Breakdown {
  item: string;
  due: number;
  paid: number;
  outstanding: number;
}
interface PaymentRow {
  paymentCode: string;
  type: string;
  amountPaid: number;
  paidDate: string | null;
  method: string | null;
}

function fmt(v: number) {
  return v || v === 0 ? `RM${Number(v).toLocaleString()}` : "-";
}
function fmtDate(v: string | null) {
  return v ? v.slice(0, 10) : "-";
}

const PAY_TYPES = ["DEPOSIT", "UTILITIES", "RENTAL", "ADMIN_FEE", "ACCESS_CARD", "AC", "LATE_FEE", "OTHER"];

export default function PaymentModal({
  contractCode,
  tenantName,
  onClose,
  onChanged,
}: {
  contractCode: string;
  tenantName: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [breakdown, setBreakdown] = useState<Breakdown[] | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [totals, setTotals] = useState({ due: 0, paid: 0, outstanding: 0 });
  const [form, setForm] = useState({ type: "RENTAL", amountPaid: "", paidDate: "", method: "Bank Transfer" });
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/contracts/${contractCode}/payments`);
    const data = await res.json();
    if (!data.success) {
      toast.danger(data.message);
      return;
    }
    setBreakdown(data.breakdown);
    setPayments(data.payments);
    setTotals({ due: data.totalDue, paid: data.totalPaid, outstanding: data.totalOutstanding });
  }, [contractCode, toast]);

  useEffect(() => {
    // setState happens after the fetch's await, not synchronously in the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function submitPay() {
    if (!form.amountPaid) {
      toast.warning("请填金额");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/contracts/${contractCode}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          paidDate: form.paidDate || new Date().toISOString().slice(0, 10),
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setForm({ type: "RENTAL", amountPaid: "", paidDate: "", method: "Bank Transfer" });
        load();
        onChanged();
      } else {
        toast.danger(data.message);
      }
    } catch {
      toast.danger("系统出错，请稍后再试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <h3 className="text-lg font-bold text-brand">
        💰 收款 — {contractCode} ({tenantName})
      </h3>

      <div className="my-3 flex gap-2.5">
        <Box label="总款" value={fmt(totals.due)} />
        <Box label="已收" value={fmt(totals.paid)} />
        <Box label="还欠" value={fmt(totals.outstanding)} color="text-red-600" />
      </div>

      {breakdown && (
        <table className="mb-3.5 w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-gray-600">
              <th className="px-2.5 py-1.5 font-semibold">项目</th>
              <th className="px-2.5 py-1.5 font-semibold">应收</th>
              <th className="px-2.5 py-1.5 font-semibold">已收</th>
              <th className="px-2.5 py-1.5 font-semibold">状态</th>
            </tr>
          </thead>
          <tbody>
            {breakdown.map((b) => (
              <tr key={b.item} className="border-b border-gray-100">
                <td className="px-2.5 py-1.5">{PAYMENT_TYPE_LABELS[b.item] ?? b.item}</td>
                <td className="px-2.5 py-1.5">{fmt(b.due)}</td>
                <td className="px-2.5 py-1.5">{fmt(b.paid)}</td>
                <td className="px-2.5 py-1.5">
                  {b.outstanding <= 0 ? (
                    <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700">✅已付</span>
                  ) : (
                    <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700">
                      欠 {fmt(b.outstanding)}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="rounded-lg bg-gray-50 p-3.5">
        <b className="text-sm">➕ 记一笔新收款</b>
        <div className="mt-2 flex flex-wrap items-end gap-2.5">
          <div className="min-w-[130px] flex-1">
            <label className="mb-1.5 block text-sm text-gray-600">项目</label>
            <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {PAY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {PAYMENT_TYPE_LABELS[t] ?? t}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[130px] flex-1">
            <label className="mb-1.5 block text-sm text-gray-600">金额 RM</label>
            <input
              type="number"
              className="input"
              value={form.amountPaid}
              onChange={(e) => setForm({ ...form, amountPaid: e.target.value })}
            />
          </div>
          <div className="min-w-[130px] flex-1">
            <label className="mb-1.5 block text-sm text-gray-600">收款日期</label>
            <input
              type="date"
              className="input"
              value={form.paidDate}
              onChange={(e) => setForm({ ...form, paidDate: e.target.value })}
            />
          </div>
          <div className="min-w-[130px] flex-1">
            <label className="mb-1.5 block text-sm text-gray-600">方式</label>
            <select className="input" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
              <option>Bank Transfer</option>
              <option>Cash</option>
              <option>Cheque</option>
            </select>
          </div>
          <button onClick={submitPay} disabled={loading} className="btn-primary">
            记录
          </button>
        </div>
      </div>

      <b className="mt-3.5 block text-sm">📜 收款历史</b>
      <table className="mt-1.5 w-full text-sm">
        <thead>
          <tr className="bg-gray-50 text-left text-gray-600">
            <th className="px-2.5 py-1.5 font-semibold">项目</th>
            <th className="px-2.5 py-1.5 font-semibold">金额</th>
            <th className="px-2.5 py-1.5 font-semibold">日期</th>
            <th className="px-2.5 py-1.5 font-semibold">方式</th>
          </tr>
        </thead>
        <tbody>
          {payments.length === 0 && (
            <tr>
              <td colSpan={4} className="py-3 text-center text-gray-400">
                还没有收款记录
              </td>
            </tr>
          )}
          {payments.map((p) => (
            <tr key={p.paymentCode} className="border-b border-gray-100">
              <td className="px-2.5 py-1.5">{PAYMENT_TYPE_LABELS[p.type] ?? p.type}</td>
              <td className="px-2.5 py-1.5">{fmt(p.amountPaid)}</td>
              <td className="px-2.5 py-1.5">{fmtDate(p.paidDate)}</td>
              <td className="px-2.5 py-1.5">{p.method || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Modal>
  );
}

function Box({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex-1 rounded-lg bg-gray-50 p-3 text-center">
      <div className={`text-lg font-bold ${color ?? "text-brand"}`}>{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}
