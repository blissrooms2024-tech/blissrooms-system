"use client";

import { useEffect, useState, useCallback } from "react";
import Modal from "@/components/Modal";
import Lightbox from "@/components/Lightbox";
import { useToast } from "@/components/Toast";
import { PAYMENT_TYPE_LABELS } from "@/lib/config";

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

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "待上传水单", cls: "bg-yellow-50 text-yellow-800" },
  PENDING_REVIEW: { label: "等 Admin 审核", cls: "bg-blue-50 text-blue-700" },
  REJECTED: { label: "被拒绝, 请重新上传", cls: "bg-red-50 text-red-700" },
};

export default function BillsModal({
  contractCode,
  onClose,
  onChanged,
}: {
  contractCode: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [totals, setTotals] = useState({ due: 0, paid: 0, outstanding: 0 });
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/contracts/${contractCode}/payments`);
    const data = await res.json();
    if (!data.success) {
      toast.danger(data.message);
      return;
    }
    setPayments(data.payments);
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
        onChanged();
      } else {
        toast.danger(data.message);
      }
    } catch {
      toast.danger("系统出错，请稍后再试");
    } finally {
      setUploadingId(null);
    }
  }

  const actionable = payments.filter((p) => p.status !== "Paid");
  const paidHistory = payments.filter((p) => p.status === "Paid");

  return (
    <Modal onClose={onClose} wide>
      <h3 className="text-lg font-bold text-brand">💳 我的账单 — {contractCode}</h3>

      <div className="my-3 flex gap-2.5">
        <Box label="总款" value={fmt(totals.due)} />
        <Box label="已收" value={fmt(totals.paid)} />
        <Box label="还欠" value={fmt(totals.outstanding)} color="text-red-600" />
      </div>

      {actionable.length > 0 && (
        <>
          <b className="mb-1.5 block text-sm">📋 待处理账单</b>
          <div className="space-y-2.5">
            {actionable.map((b) => {
              const badge = STATUS_BADGE[b.status] ?? { label: b.status, cls: "bg-gray-100 text-gray-600" };
              return (
                <div key={b.id} className="rounded-lg border border-gray-200 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <b className="text-sm">{PAYMENT_TYPE_LABELS[b.type] ?? b.type}</b>{" "}
                      <span className="text-sm text-gray-600">{fmt(b.amountDue)}</span>
                      {b.periodMonth && <span className="ml-1.5 text-xs text-gray-400">({b.periodMonth})</span>}
                      <div className="text-xs text-gray-500">到期日: {fmtDate(b.dueDate)}</div>
                    </div>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge.cls}`}>
                      {badge.label}
                    </span>
                  </div>
                  {b.status === "REJECTED" && b.reviewNote && (
                    <div className="mt-1.5 rounded bg-red-50 p-2 text-xs text-red-600">拒绝原因: {b.reviewNote}</div>
                  )}
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
              <td className="px-2.5 py-1.5">{PAYMENT_TYPE_LABELS[p.type] ?? p.type}</td>
              <td className="px-2.5 py-1.5">{fmt(p.amountPaid)}</td>
              <td className="px-2.5 py-1.5">{fmtDate(p.paidDate)}</td>
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
