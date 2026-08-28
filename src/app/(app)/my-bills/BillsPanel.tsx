"use client";

import { useEffect, useState, useCallback } from "react";
import Lightbox from "@/components/Lightbox";
import StepTimeline, { TimelineStep } from "@/components/StepTimeline";
import { useToast } from "@/components/Toast";
import { PAYMENT_TYPE_LABELS, paymentTypeLabel } from "@/lib/config";

interface BreakdownRow {
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
  receiptLink: string | null;
  reviewNote: string | null;
  periodMonth: string | null;
  customLabel: string | null;
}

function fmt(v: number) {
  return v || v === 0 ? `RM${Number(v).toLocaleString()}` : "-";
}
function fmtDate(v: string | null) {
  return v ? v.slice(0, 10) : "-";
}
function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const BILL_FLOW = ["PENDING", "PENDING_REVIEW", "Paid"];

function buildBillSteps(b: PaymentRow): TimelineStep[] {
  if (b.status === "REJECTED") {
    return [
      { label: "账单已开", state: "done" },
      { label: "已上传水单", state: "done" },
      { label: "已拒绝", sublabel: b.reviewNote ?? undefined, state: "rejected" },
    ];
  }
  const currentIndex = BILL_FLOW.indexOf(b.status);
  return [
    { label: "账单已开", state: 0 < currentIndex ? "done" : currentIndex === 0 ? "active" : "pending" },
    {
      label: "已上传水单",
      sublabel: b.paidDate ? b.paidDate.slice(0, 10) : undefined,
      state: 1 < currentIndex ? "done" : currentIndex === 1 ? "active" : "pending",
    },
    { label: "已批准", state: currentIndex === 2 ? "done" : "pending" },
  ];
}

export default function BillsPanel({ contractCode }: { contractCode: string }) {
  const toast = useToast();
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [breakdown, setBreakdown] = useState<BreakdownRow[]>([]);
  const [totals, setTotals] = useState({ due: 0, paid: 0, outstanding: 0 });
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState<Record<string, string>>({});
  const [payFile, setPayFile] = useState<Record<string, File | null>>({});
  const [paySubmitting, setPaySubmitting] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    const res = await fetch(`/api/contracts/${contractCode}/payments`);
    const data = await res.json();
    if (!data.success) {
      toast.danger(data.message);
      return;
    }
    // AC top-ups live on their own 冷气充值 page now, not here.
    setPayments((data.payments as PaymentRow[]).filter((p) => p.type !== "AC"));
    setBreakdown(data.breakdown ?? []);
    setTotals({ due: data.totalDue, paid: data.totalPaid, outstanding: data.totalOutstanding });
  }, [contractCode, toast]);

  useEffect(() => {
    // setState happens after the fetch's await, not synchronously in the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function uploadSlip(paymentId: string, file: File) {
    if (file.size > 3 * 1024 * 1024) {
      toast.warning("图片太大(超过3MB)，请压缩");
      return;
    }
    setUploadingId(paymentId);
    try {
      const dataUrl = await readAsDataURL(file);
      const res = await fetch(`/api/contracts/${contractCode}/bills/${paymentId}/slip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        load();
      } else {
        toast.danger(data.message);
      }
    } catch {
      toast.danger("系统出错，请稍后再试");
    } finally {
      setUploadingId(null);
    }
  }

  async function submitBreakdownPay(item: string) {
    const amount = Number(payAmount[item]);
    if (!amount || amount <= 0) {
      toast.warning("请填正确的金额");
      return;
    }
    const file = payFile[item];
    if (!file) {
      toast.warning("请上传付款证明");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      toast.warning("图片太大(超过3MB)，请压缩");
      return;
    }
    setPaySubmitting((s) => ({ ...s, [item]: true }));
    try {
      const dataUrl = await readAsDataURL(file);
      const res = await fetch(`/api/contracts/${contractCode}/breakdown-pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item, amount, dataUrl }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setPayAmount((s) => ({ ...s, [item]: "" }));
        setPayFile((s) => ({ ...s, [item]: null }));
        load();
      } else {
        toast.danger(data.message);
      }
    } catch {
      toast.danger("系统出错，请稍后再试");
    } finally {
      setPaySubmitting((s) => ({ ...s, [item]: false }));
    }
  }

  const actionable = payments.filter((p) => p.status !== "Paid");
  const paidHistory = payments.filter((p) => p.status === "Paid");
  // Items still owed but that Admin hasn't opened a bill for yet — tenant can self-initiate
  // payment on these directly instead of waiting for Admin to issue one.
  const coveredTypes = new Set(actionable.map((p) => p.type));
  const payableItems = breakdown.filter((b) => b.outstanding > 0 && !coveredTypes.has(b.item));

  return (
    <div className="rounded-xl bg-white p-5 shadow-sm">
      <h3 className="text-lg font-bold text-brand">💳 我的账单 — {contractCode}</h3>

      <div className="my-3 flex gap-2.5">
        <Box label="总款" value={fmt(totals.due)} />
        <Box label="已收" value={fmt(totals.paid)} />
        <Box label="还欠" value={fmt(totals.outstanding)} color="text-red-600" />
      </div>

      {breakdown.length > 0 && (
        <>
          <b className="mb-1.5 block text-sm">🧾 费用明细</b>
          <table className="mb-3.5 w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-gray-600">
                <th className="px-2.5 py-1.5 font-semibold">项目</th>
                <th className="px-2.5 py-1.5 font-semibold">应收</th>
                <th className="px-2.5 py-1.5 font-semibold">已收</th>
                <th className="px-2.5 py-1.5 font-semibold">还欠</th>
              </tr>
            </thead>
            <tbody>
              {breakdown.map((b) => (
                <tr key={b.item} className="border-b border-gray-100">
                  <td className="px-2.5 py-1.5">{PAYMENT_TYPE_LABELS[b.item] ?? b.item}</td>
                  <td className="px-2.5 py-1.5">{fmt(b.due)}</td>
                  <td className="px-2.5 py-1.5">{fmt(b.paid)}</td>
                  <td className="px-2.5 py-1.5">
                    {b.outstanding > 0 ? (
                      <span className="font-semibold text-red-600">{fmt(b.outstanding)}</span>
                    ) : (
                      <span className="text-green-700">✅清</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {payableItems.length > 0 && (
        <>
          <b className="mb-1.5 block text-sm">💰 立即付款</b>
          <p className="mb-2 text-xs text-gray-400">Admin 还没为这些项目开账单，你可以先转账后自己上传付款证明</p>
          <div className="mb-3.5 space-y-2.5">
            {payableItems.map((b) => (
              <div key={b.item} className="rounded-lg border border-gray-200 p-3">
                <div className="mb-2">
                  <b className="text-sm">{PAYMENT_TYPE_LABELS[b.item] ?? b.item}</b>{" "}
                  <span className="text-sm text-gray-600">还欠 {fmt(b.outstanding)}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    placeholder="金额 RM"
                    value={payAmount[b.item] ?? ""}
                    onChange={(e) => setPayAmount((s) => ({ ...s, [b.item]: e.target.value }))}
                    className="input w-[120px]"
                  />
                  <input
                    type="file"
                    accept="image/*"
                    disabled={!!paySubmitting[b.item]}
                    onChange={(e) => setPayFile((s) => ({ ...s, [b.item]: e.target.files?.[0] ?? null }))}
                    className="block text-sm text-gray-500 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-brand file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-brand-dark disabled:opacity-50"
                  />
                  <button
                    onClick={() => submitBreakdownPay(b.item)}
                    disabled={!!paySubmitting[b.item]}
                    className="btn-primary px-3.5 py-1.5 text-xs"
                  >
                    {paySubmitting[b.item] ? "提交中..." : "提交付款证明"}
                  </button>
                </div>
                {payFile[b.item] && (
                  <div className="mt-1.5 text-xs text-gray-500">已选择: {payFile[b.item]!.name}</div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {actionable.length > 0 && (
        <>
          <b className="mb-1.5 block text-sm">📋 待处理账单</b>
          <div className="space-y-2.5">
            {actionable.map((b) => {
              return (
                <div key={b.id} className="rounded-lg border border-gray-200 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-[160px] flex-1">
                      <b className="text-sm">{paymentTypeLabel(b.type, b.customLabel)}</b>{" "}
                      <span className="text-sm text-gray-600">{fmt(b.amountDue)}</span>
                      {b.periodMonth && <span className="ml-1.5 text-xs text-gray-400">({b.periodMonth})</span>}
                      <div className="text-xs text-gray-500">到期日: {fmtDate(b.dueDate)}</div>
                    </div>
                    <div className="w-full sm:w-auto sm:min-w-[150px]">
                      <StepTimeline steps={buildBillSteps(b)} />
                    </div>
                  </div>
                  {b.status === "PENDING_REVIEW" && b.receiptLink && (
                    <button
                      type="button"
                      onClick={() => setZoomUrl(b.receiptLink)}
                      className="mt-2 text-xs font-semibold text-brand underline"
                    >
                      🧾 查看已上传的水单
                    </button>
                  )}
                  {(b.status === "PENDING" || b.status === "REJECTED") && (
                    <div className="mt-2">
                      <input
                        type="file"
                        accept="image/*"
                        disabled={uploadingId === b.id}
                        onChange={(e) => e.target.files?.[0] && uploadSlip(b.id, e.target.files[0])}
                        className="block text-sm text-gray-500 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-brand file:px-3.5 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-brand-dark disabled:opacity-50"
                      />
                      {uploadingId === b.id && <span className="ml-2 text-sm text-gray-500">上传中...</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      <b className="mt-3.5 block text-sm">📜 已付款记录</b>
      <table className="mt-1.5 w-full text-sm">
        <thead>
          <tr className="bg-gray-50 text-left text-gray-600">
            <th className="px-2.5 py-1.5 font-semibold">项目</th>
            <th className="px-2.5 py-1.5 font-semibold">金额</th>
            <th className="px-2.5 py-1.5 font-semibold">日期</th>
          </tr>
        </thead>
        <tbody>
          {paidHistory.length === 0 && (
            <tr>
              <td colSpan={3} className="py-3 text-center text-gray-400">
                还没有付款记录
              </td>
            </tr>
          )}
          {paidHistory.map((p) => (
            <tr key={p.paymentCode} className="border-b border-gray-100">
              <td className="px-2.5 py-1.5">{paymentTypeLabel(p.type, p.customLabel)}</td>
              <td className="px-2.5 py-1.5">{fmt(p.amountPaid)}</td>
              <td className="px-2.5 py-1.5">{fmtDate(p.paidDate)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {zoomUrl && <Lightbox src={zoomUrl} alt="水单" onClose={() => setZoomUrl(null)} />}
    </div>
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
