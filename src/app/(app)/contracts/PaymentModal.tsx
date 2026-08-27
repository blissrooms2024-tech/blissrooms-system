"use client";

import { useEffect, useState, useCallback } from "react";
import Modal from "@/components/Modal";
import Lightbox from "@/components/Lightbox";
import { useToast } from "@/components/Toast";
import { PAYMENT_TYPE_LABELS } from "@/lib/config";

interface Breakdown {
  item: string;
  due: number;
  paid: number;
  outstanding: number;
}
interface PaymentRow {
  id: string;
  paymentCode: string;
  type: string;
  amountDue: number;
  amountPaid: number;
  status: string;
  dueDate: string | null;
  paidDate: string | null;
  method: string | null;
  receiptLink: string | null;
  reviewNote: string | null;
  periodMonth: string | null;
}

function fmt(v: number) {
  return v || v === 0 ? `RM${Number(v).toLocaleString()}` : "-";
}
function fmtDate(v: string | null) {
  return v ? v.slice(0, 10) : "-";
}

const PAY_TYPES = ["DEPOSIT", "UTILITIES", "RENTAL", "ADMIN_FEE", "ACCESS_CARD", "AC", "DRYER", "LATE_FEE", "OTHER"];
const BILL_TYPES = ["DEPOSIT", "UTILITIES", "RENTAL", "ADMIN_FEE", "ACCESS_CARD", "AC", "DRYER", "OTHER"];

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "待上传水单", cls: "bg-gray-100 text-gray-600" },
  PENDING_REVIEW: { label: "待审核", cls: "bg-yellow-50 text-yellow-800" },
  REJECTED: { label: "已拒绝", cls: "bg-red-50 text-red-700" },
};

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
  const [hasAircon, setHasAircon] = useState(false);
  const [form, setForm] = useState({ type: "RENTAL", amountPaid: "", paidDate: "", method: "Bank Transfer" });
  const [billForm, setBillForm] = useState({ type: "RENTAL", amountDue: "", dueDate: "", periodMonth: "" });
  const [loading, setLoading] = useState(false);
  const [billLoading, setBillLoading] = useState(false);
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

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
    setHasAircon(!!data.contract?.room?.hasAircon);
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

  async function createBill() {
    if (!billForm.amountDue || !billForm.dueDate) {
      toast.warning("金额和到期日一定要填");
      return;
    }
    setBillLoading(true);
    try {
      const res = await fetch(`/api/contracts/${contractCode}/bills`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(billForm),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setBillForm({ type: "RENTAL", amountDue: "", dueDate: "", periodMonth: "" });
        load();
        onChanged();
      } else {
        toast.danger(data.message);
      }
    } catch {
      toast.danger("系统出错，请稍后再试");
    } finally {
      setBillLoading(false);
    }
  }

  async function approveBill(id: string) {
    const res = await fetch(`/api/payments/${id}/approve`, { method: "POST" });
    const data = await res.json();
    if (data.success) toast.success(data.message);
    else toast.danger(data.message);
    load();
    onChanged();
  }

  async function rejectBill(id: string) {
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
    onChanged();
  }

  async function waiveLateFee(id: string) {
    const res = await fetch(`/api/payments/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (data.success) toast.success(data.message);
    else toast.danger(data.message);
    load();
    onChanged();
  }

  const paidHistory = payments.filter((p) => p.status === "Paid");
  const bills = payments.filter((p) => p.status !== "Paid");
  const billTypeOptions = BILL_TYPES.filter((t) => t !== "AC" || hasAircon);

  return (
    <Modal onClose={onClose} wide>
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
        <b className="text-sm">➕ 记一笔新收款 (Admin 直接确认已收)</b>
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

      <div className="mt-3.5 rounded-lg bg-violet-50 p-3.5">
        <b className="text-sm">🧾 开新账单 (租客要上传水单, Admin 审核后才算已付)</b>
        <div className="mt-2 flex flex-wrap items-end gap-2.5">
          <div className="min-w-[110px] flex-1">
            <label className="mb-1.5 block text-sm text-gray-600">项目</label>
            <select
              className="input"
              value={billForm.type}
              onChange={(e) => setBillForm({ ...billForm, type: e.target.value })}
            >
              {billTypeOptions.map((t) => (
                <option key={t} value={t}>
                  {PAYMENT_TYPE_LABELS[t] ?? t}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[110px] flex-1">
            <label className="mb-1.5 block text-sm text-gray-600">金额 RM</label>
            <input
              type="number"
              className="input"
              value={billForm.amountDue}
              onChange={(e) => setBillForm({ ...billForm, amountDue: e.target.value })}
            />
          </div>
          <div className="min-w-[130px] flex-1">
            <label className="mb-1.5 block text-sm text-gray-600">到期日</label>
            <input
              type="date"
              className="input"
              value={billForm.dueDate}
              onChange={(e) => setBillForm({ ...billForm, dueDate: e.target.value })}
            />
          </div>
          <div className="min-w-[110px] flex-1">
            <label className="mb-1.5 block text-sm text-gray-600">月份 (选填)</label>
            <input
              type="month"
              className="input"
              value={billForm.periodMonth}
              onChange={(e) => setBillForm({ ...billForm, periodMonth: e.target.value })}
            />
          </div>
          <button onClick={createBill} disabled={billLoading} className="btn-primary">
            开账单
          </button>
        </div>
        {!hasAircon && <div className="mt-1.5 text-xs text-gray-500">这间房没有冷气，冷气账单不会出现在选项里</div>}
      </div>

      {bills.length > 0 && (
        <>
          <b className="mt-3.5 block text-sm">📋 账单 (待处理)</b>
          <table className="mt-1.5 w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-gray-600">
                <th className="px-2.5 py-1.5 font-semibold">项目</th>
                <th className="px-2.5 py-1.5 font-semibold">金额</th>
                <th className="px-2.5 py-1.5 font-semibold">到期日</th>
                <th className="px-2.5 py-1.5 font-semibold">状态</th>
                <th className="px-2.5 py-1.5 font-semibold">操作</th>
              </tr>
            </thead>
            <tbody>
              {bills.map((b) => {
                const badge = STATUS_BADGE[b.status] ?? { label: b.status, cls: "bg-gray-100 text-gray-600" };
                return (
                  <tr key={b.id} className="border-b border-gray-100 align-top">
                    <td className="px-2.5 py-1.5">{PAYMENT_TYPE_LABELS[b.type] ?? b.type}</td>
                    <td className="px-2.5 py-1.5">{fmt(b.amountDue)}</td>
                    <td className="px-2.5 py-1.5">{fmtDate(b.dueDate)}</td>
                    <td className="px-2.5 py-1.5">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${badge.cls}`}>{badge.label}</span>
                      {b.status === "REJECTED" && b.reviewNote && (
                        <div className="mt-1 max-w-[160px] text-xs text-red-600">原因: {b.reviewNote}</div>
                      )}
                    </td>
                    <td className="px-2.5 py-1.5">
                      {b.status === "PENDING_REVIEW" && (
                        <div className="flex flex-col items-start gap-1.5">
                          {b.receiptLink && (
                            <button
                              type="button"
                              onClick={() => setZoomUrl(b.receiptLink)}
                              className="text-xs font-semibold text-brand underline"
                            >
                              🧾 查看水单
                            </button>
                          )}
                          {rejectingId === b.id ? (
                            <div className="flex flex-col gap-1.5">
                              <input
                                className="input text-xs"
                                placeholder="拒绝原因"
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                              />
                              <div className="flex gap-1.5">
                                <button
                                  onClick={() => rejectBill(b.id)}
                                  className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-semibold text-white"
                                >
                                  确定拒绝
                                </button>
                                <button
                                  onClick={() => {
                                    setRejectingId(null);
                                    setRejectReason("");
                                  }}
                                  className="rounded-md bg-gray-100 px-2.5 py-1 text-xs text-gray-600"
                                >
                                  取消
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => approveBill(b.id)}
                                className="rounded-md bg-green-700 px-2.5 py-1 text-xs font-semibold text-white"
                              >
                                ✅ 批准
                              </button>
                              <button
                                onClick={() => setRejectingId(b.id)}
                                className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-semibold text-white"
                              >
                                ✗ 拒绝
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                      {b.status !== "PENDING_REVIEW" && b.type === "LATE_FEE" && (b.status === "PENDING" || b.status === "REJECTED") && (
                        <button
                          onClick={() => waiveLateFee(b.id)}
                          className="rounded-md bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-200"
                        >
                          🗑️ 撤销罚款
                        </button>
                      )}
                      {b.status !== "PENDING_REVIEW" && !(b.type === "LATE_FEE" && (b.status === "PENDING" || b.status === "REJECTED")) && (
                        <span className="text-xs text-gray-400">等租客上传</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}

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
          {paidHistory.length === 0 && (
            <tr>
              <td colSpan={4} className="py-3 text-center text-gray-400">
                还没有收款记录
              </td>
            </tr>
          )}
          {paidHistory.map((p) => (
            <tr key={p.paymentCode} className="border-b border-gray-100">
              <td className="px-2.5 py-1.5">{PAYMENT_TYPE_LABELS[p.type] ?? p.type}</td>
              <td className="px-2.5 py-1.5">{fmt(p.amountPaid)}</td>
              <td className="px-2.5 py-1.5">{fmtDate(p.paidDate)}</td>
              <td className="px-2.5 py-1.5">{p.method || (p.receiptLink ? "水单上传" : "-")}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {zoomUrl && <Lightbox src={zoomUrl} alt="水单" onClose={() => setZoomUrl(null)} />}
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
