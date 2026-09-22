"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import Modal from "@/components/Modal";
import Lightbox from "@/components/Lightbox";
import { useToast } from "@/components/Toast";
import { useLanguage } from "@/components/LanguageProvider";
import { paymentTypeLabelLocale } from "@/lib/config";
import { fmtDate } from "@/lib/format";

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
  customLabel: string | null;
}

function fmt(v: number) {
  return v || v === 0 ? `RM${Number(v).toLocaleString()}` : "-";
}
function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
const PAY_TYPES = ["DEPOSIT", "UTILITIES", "RENTAL", "ADMIN_FEE", "ACCESS_CARD", "CARPARK", "AC", "DRYER", "ELECTRIC", "LATE_FEE", "OTHER"];
const BILL_TYPES = ["DEPOSIT", "UTILITIES", "RENTAL", "ADMIN_FEE", "ACCESS_CARD", "CARPARK", "AC", "DRYER", "ELECTRIC", "OTHER"];

function statusBadge(status: string, t: (zh: string, en: string) => string): { label: string; cls: string } {
  const map: Record<string, { label: string; cls: string }> = {
    PENDING: { label: t("待上传交易单", "Pending Upload"), cls: "bg-gray-100 text-gray-600" },
    PENDING_REVIEW: { label: t("待审核", "Pending Review"), cls: "bg-yellow-50 text-yellow-800" },
    REJECTED: { label: t("已拒绝", "Rejected"), cls: "bg-red-50 text-red-700" },
  };
  return map[status] ?? { label: status, cls: "bg-gray-100 text-gray-600" };
}

export default function PaymentModal({
  contractCode,
  tenantName,
  role,
  onClose,
  onChanged,
}: {
  contractCode: string;
  tenantName: string;
  role: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const { locale, t } = useLanguage();
  const [breakdown, setBreakdown] = useState<Breakdown[] | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [totals, setTotals] = useState({ due: 0, paid: 0, outstanding: 0 });
  const [hasAircon, setHasAircon] = useState(false);
  const [form, setForm] = useState({ type: "RENTAL", amountPaid: "", paidDate: "", method: "Bank Transfer", customLabel: "" });
  const [billForm, setBillForm] = useState({ type: "RENTAL", amountDue: "", dueDate: "", periodMonth: "", customLabel: "" });
  const [lumpForm, setLumpForm] = useState({ amount: "", paidDate: "", method: "Bank Transfer" });
  const [lumpFile, setLumpFile] = useState<File | null>(null);
  const [lumpLoading, setLumpLoading] = useState(false);
  const lumpFileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [billLoading, setBillLoading] = useState(false);
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editMethod, setEditMethod] = useState("Bank Transfer");
  const [editSaving, setEditSaving] = useState(false);

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
      toast.warning(t("请填金额", "Please enter an amount"));
      return;
    }
    if (form.type === "OTHER" && !form.customLabel.trim()) {
      toast.warning(t("「其他」类型要填费用名称", "\"Other\" type needs a charge name"));
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
        setForm({ type: "RENTAL", amountPaid: "", paidDate: "", method: "Bank Transfer", customLabel: "" });
        load();
        onChanged();
      } else {
        toast.danger(data.message);
      }
    } catch {
      toast.danger(t("系统出错，请稍后再试", "System error — please try again later"));
    } finally {
      setLoading(false);
    }
  }

  async function submitLump() {
    if (!lumpForm.amount) {
      toast.warning(t("请填金额", "Please enter an amount"));
      return;
    }
    if (lumpFile && lumpFile.size > 3 * 1024 * 1024) {
      toast.warning(t("图片太大(超过3MB)，请压缩", "Image too large (over 3MB) — please compress it"));
      return;
    }
    setLumpLoading(true);
    try {
      const dataUrl = lumpFile ? await readAsDataURL(lumpFile) : undefined;
      const res = await fetch(`/api/contracts/${contractCode}/collect-lump-sum`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: lumpForm.amount,
          dataUrl,
          method: lumpForm.method,
          paidDate: lumpForm.paidDate || new Date().toISOString().slice(0, 10),
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setLumpForm({ amount: "", paidDate: "", method: "Bank Transfer" });
        setLumpFile(null);
        if (lumpFileInputRef.current) lumpFileInputRef.current.value = "";
        load();
        onChanged();
      } else {
        toast.danger(data.message);
      }
    } catch {
      toast.danger(t("系统出错，请稍后再试", "System error — please try again later"));
    } finally {
      setLumpLoading(false);
    }
  }

  async function createBill() {
    if (!billForm.amountDue || !billForm.dueDate) {
      toast.warning(t("金额和到期日一定要填", "Amount and due date are both required"));
      return;
    }
    if (billForm.type === "OTHER" && !billForm.customLabel.trim()) {
      toast.warning(t("「其他」类型要填费用名称", "\"Other\" type needs a charge name"));
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
        setBillForm({ type: "RENTAL", amountDue: "", dueDate: "", periodMonth: "", customLabel: "" });
        load();
        onChanged();
      } else {
        toast.danger(data.message);
      }
    } catch {
      toast.danger(t("系统出错，请稍后再试", "System error — please try again later"));
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
      toast.warning(t("请填拒绝原因", "Please enter a rejection reason"));
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

  function startEditDate(p: PaymentRow) {
    setEditingId(p.id);
    setEditDate(p.paidDate ? p.paidDate.slice(0, 10) : "");
    setEditMethod(p.method || "Bank Transfer");
  }

  async function saveEditDate(id: string) {
    if (!editDate) {
      toast.warning(t("请选日期", "Please select a date"));
      return;
    }
    setEditSaving(true);
    try {
      const res = await fetch(`/api/payments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paidDate: editDate, method: editMethod }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setEditingId(null);
        load();
      } else {
        toast.danger(data.message);
      }
    } catch {
      toast.danger(t("系统出错，请稍后再试", "System error — please try again later"));
    } finally {
      setEditSaving(false);
    }
  }

  const paidHistory = payments.filter((p) => p.status === "Paid");
  const bills = payments.filter((p) => p.status !== "Paid");
  const billTypeOptions = BILL_TYPES.filter((t) => t !== "AC" || hasAircon);

  return (
    <Modal onClose={onClose} wide>
      <h3 className="text-lg font-bold text-brand">
        💰 {t("收款", "Payments")} — {contractCode} ({tenantName})
      </h3>

      <div className="my-3 flex gap-2.5">
        <Box label={t("总款", "Total")} value={fmt(totals.due)} />
        <Box label={t("已收", "Paid")} value={fmt(totals.paid)} />
        <Box label={t("还欠", "Owing")} value={fmt(totals.outstanding)} color="text-red-600" />
      </div>

      {breakdown && (
        <table className="mb-3.5 w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-gray-600">
              <th className="px-2.5 py-1.5 font-semibold">{t("项目", "Item")}</th>
              <th className="px-2.5 py-1.5 font-semibold">{t("应收", "Due")}</th>
              <th className="px-2.5 py-1.5 font-semibold">{t("已收", "Paid")}</th>
              <th className="px-2.5 py-1.5 font-semibold">{t("状态", "Status")}</th>
            </tr>
          </thead>
          <tbody>
            {breakdown.map((b) => (
              <tr key={b.item} className="border-b border-gray-100">
                <td className="px-2.5 py-1.5">{paymentTypeLabelLocale(b.item, null, locale)}</td>
                <td className="px-2.5 py-1.5">{fmt(b.due)}</td>
                <td className="px-2.5 py-1.5">{fmt(b.paid)}</td>
                <td className="px-2.5 py-1.5">
                  {b.outstanding <= 0 ? (
                    <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700">✅{t("已付", "Paid")}</span>
                  ) : (
                    <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700">
                      {t("欠", "Owing")} {fmt(b.outstanding)}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="rounded-lg bg-brand-light/40 p-3.5">
        <b className="text-sm">
          💰{" "}
          {t(
            "一笔过收款 (租客一次过转账/现金, 按 押金→水电押→Admin Fee→门卡押→车位→房租 顺序分配)",
            "Lump-Sum Payment (tenant pays a single transfer/cash amount, allocated in order: Deposit → Utilities Deposit → Admin Fee → Access Card Deposit → Carpark → Rent)"
          )}
        </b>
        <div className="mt-2 flex flex-wrap items-end gap-2.5">
          <div className="min-w-[130px] flex-1">
            <label className="mb-1.5 block text-sm text-gray-600">{t("总金额 RM", "Total Amount RM")}</label>
            <input
              type="number"
              className="input"
              value={lumpForm.amount}
              onChange={(e) => setLumpForm({ ...lumpForm, amount: e.target.value })}
            />
          </div>
          <div className="min-w-[130px] flex-1">
            <label className="mb-1.5 block text-sm text-gray-600">{t("收款日期", "Payment Date")}</label>
            <input
              type="date"
              className="input"
              value={lumpForm.paidDate}
              onChange={(e) => setLumpForm({ ...lumpForm, paidDate: e.target.value })}
            />
          </div>
          <div className="min-w-[130px] flex-1">
            <label className="mb-1.5 block text-sm text-gray-600">{t("方式", "Method")}</label>
            <select className="input" value={lumpForm.method} onChange={(e) => setLumpForm({ ...lumpForm, method: e.target.value })}>
              <option>Bank Transfer</option>
              <option>Cash</option>
              <option>Cheque</option>
            </select>
          </div>
          <div className="min-w-[160px] flex-1">
            <label className="mb-1.5 block text-sm text-gray-600">{t("交易单 (选填)", "Transaction Slip (optional)")}</label>
            <input
              ref={lumpFileInputRef}
              type="file"
              accept="image/*"
              disabled={lumpLoading}
              onChange={(e) => setLumpFile(e.target.files?.[0] ?? null)}
              className="block w-full text-xs text-gray-500 file:mr-2 file:cursor-pointer file:rounded-lg file:border-0 file:bg-brand file:px-2.5 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-brand-dark disabled:opacity-50"
            />
            {lumpFile && <div className="mt-1 text-xs text-gray-500">{t("已选择", "Selected")}: {lumpFile.name}</div>}
          </div>
          <button onClick={submitLump} disabled={lumpLoading} className="btn-primary">
            {t("记录", "Record")}
          </button>
        </div>
        <p className="mt-1.5 text-xs text-gray-500">
          {t(
            "金额没付完全部项目时，会按上面的顺序分配，付不完的项目部分已收，还欠剩下的差额。",
            "If the amount doesn't cover every item, it's allocated in the order above — a partially-covered item is marked partly paid, with the remaining balance still owing."
          )}
        </p>
      </div>

      <div className="mt-3.5 rounded-lg bg-gray-50 p-3.5">
        <b className="text-sm">➕ {t("记一笔新收款 (单一项目, 直接确认已收, 不用再审核)", "Record a New Payment (single item, confirmed as paid immediately, no review needed)")}</b>
        <div className="mt-2 flex flex-wrap items-end gap-2.5">
          <div className="min-w-[130px] flex-1">
            <label className="mb-1.5 block text-sm text-gray-600">{t("项目", "Item")}</label>
            <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {PAY_TYPES.map((pt) => (
                <option key={pt} value={pt}>
                  {paymentTypeLabelLocale(pt, null, locale)}
                </option>
              ))}
            </select>
          </div>
          {form.type === "OTHER" && (
            <div className="min-w-[130px] flex-1">
              <label className="mb-1.5 block text-sm text-gray-600">{t("费用名称", "Charge Name")}</label>
              <input
                className="input"
                placeholder={t("例: 清洁费", "e.g. Cleaning Fee")}
                value={form.customLabel}
                onChange={(e) => setForm({ ...form, customLabel: e.target.value })}
              />
            </div>
          )}
          <div className="min-w-[130px] flex-1">
            <label className="mb-1.5 block text-sm text-gray-600">{t("金额 RM", "Amount RM")}</label>
            <input
              type="number"
              className="input"
              value={form.amountPaid}
              onChange={(e) => setForm({ ...form, amountPaid: e.target.value })}
            />
          </div>
          <div className="min-w-[130px] flex-1">
            <label className="mb-1.5 block text-sm text-gray-600">{t("收款日期", "Payment Date")}</label>
            <input
              type="date"
              className="input"
              value={form.paidDate}
              onChange={(e) => setForm({ ...form, paidDate: e.target.value })}
            />
          </div>
          <div className="min-w-[130px] flex-1">
            <label className="mb-1.5 block text-sm text-gray-600">{t("方式", "Method")}</label>
            <select className="input" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
              <option>Bank Transfer</option>
              <option>Cash</option>
              <option>Cheque</option>
            </select>
          </div>
          <button onClick={submitPay} disabled={loading} className="btn-primary">
            {t("记录", "Record")}
          </button>
        </div>
      </div>

      {role === "ADMIN" && (
      <div className="mt-3.5 rounded-lg bg-violet-50 p-3.5">
        <b className="text-sm">🧾 {t("开新账单 (租客要上传交易单, Admin 审核后才算已付)", "Create New Bill (tenant must upload a transaction slip; only counted as paid after Admin review)")}</b>
        <div className="mt-2 flex flex-wrap items-end gap-2.5">
          <div className="min-w-[110px] flex-1">
            <label className="mb-1.5 block text-sm text-gray-600">{t("项目", "Item")}</label>
            <select
              className="input"
              value={billForm.type}
              onChange={(e) => setBillForm({ ...billForm, type: e.target.value })}
            >
              {billTypeOptions.map((bt) => (
                <option key={bt} value={bt}>
                  {paymentTypeLabelLocale(bt, null, locale)}
                </option>
              ))}
            </select>
          </div>
          {billForm.type === "OTHER" && (
            <div className="min-w-[110px] flex-1">
              <label className="mb-1.5 block text-sm text-gray-600">{t("费用名称", "Charge Name")}</label>
              <input
                className="input"
                placeholder={t("例: 清洁费", "e.g. Cleaning Fee")}
                value={billForm.customLabel}
                onChange={(e) => setBillForm({ ...billForm, customLabel: e.target.value })}
              />
            </div>
          )}
          <div className="min-w-[110px] flex-1">
            <label className="mb-1.5 block text-sm text-gray-600">{t("金额 RM", "Amount RM")}</label>
            <input
              type="number"
              className="input"
              value={billForm.amountDue}
              onChange={(e) => setBillForm({ ...billForm, amountDue: e.target.value })}
            />
          </div>
          <div className="min-w-[130px] flex-1">
            <label className="mb-1.5 block text-sm text-gray-600">{t("到期日", "Due Date")}</label>
            <input
              type="date"
              className="input"
              value={billForm.dueDate}
              onChange={(e) => setBillForm({ ...billForm, dueDate: e.target.value })}
            />
          </div>
          <div className="min-w-[110px] flex-1">
            <label className="mb-1.5 block text-sm text-gray-600">{t("月份 (选填)", "Month (optional)")}</label>
            <input
              type="month"
              className="input"
              value={billForm.periodMonth}
              onChange={(e) => setBillForm({ ...billForm, periodMonth: e.target.value })}
            />
          </div>
          <button onClick={createBill} disabled={billLoading} className="btn-primary">
            {t("开账单", "Create Bill")}
          </button>
        </div>
        {!hasAircon && (
          <div className="mt-1.5 text-xs text-gray-500">
            {t("这间房没有冷气，冷气账单不会出现在选项里", "This room has no air-conditioner — the AC bill option won't appear")}
          </div>
        )}
      </div>
      )}

      {bills.length > 0 && (
        <>
          <b className="mt-3.5 block text-sm">📋 {t("账单 (待处理)", "Bills (Pending)")}</b>
          <table className="mt-1.5 w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-gray-600">
                <th className="px-2.5 py-1.5 font-semibold">{t("项目", "Item")}</th>
                <th className="px-2.5 py-1.5 font-semibold">{t("金额", "Amount")}</th>
                <th className="px-2.5 py-1.5 font-semibold">{t("到期日", "Due Date")}</th>
                <th className="px-2.5 py-1.5 font-semibold">{t("状态", "Status")}</th>
                <th className="px-2.5 py-1.5 font-semibold">{t("操作", "Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {bills.map((b) => {
                const badge = statusBadge(b.status, t);
                return (
                  <tr key={b.id} className="border-b border-gray-100 align-top">
                    <td className="px-2.5 py-1.5">
                      {paymentTypeLabelLocale(b.type, b.customLabel, locale)}
                      <Link href={`/invoice/${b.paymentCode}`} target="_blank" className="block text-xs font-semibold text-brand underline">
                        📄 Invoice
                      </Link>
                    </td>
                    <td className="px-2.5 py-1.5">{fmt(b.amountDue)}</td>
                    <td className="px-2.5 py-1.5">{fmtDate(b.dueDate)}</td>
                    <td className="px-2.5 py-1.5">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${badge.cls}`}>{badge.label}</span>
                      {b.status === "REJECTED" && b.reviewNote && (
                        <div className="mt-1 max-w-[160px] text-xs text-red-600">{t("原因", "Reason")}: {b.reviewNote}</div>
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
                              🧾 {t("查看交易单", "View Transaction Slip")}
                            </button>
                          )}
                          {role !== "ADMIN" ? (
                            <span className="text-xs text-gray-400">{t("等 Admin 审核", "Waiting for Admin review")}</span>
                          ) : rejectingId === b.id ? (
                            <div className="flex flex-col gap-1.5">
                              <input
                                className="input text-xs"
                                placeholder={t("拒绝原因", "Rejection Reason")}
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                              />
                              <div className="flex gap-1.5">
                                <button
                                  onClick={() => rejectBill(b.id)}
                                  className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-semibold text-white"
                                >
                                  {t("确定拒绝", "Confirm Reject")}
                                </button>
                                <button
                                  onClick={() => {
                                    setRejectingId(null);
                                    setRejectReason("");
                                  }}
                                  className="rounded-md bg-gray-100 px-2.5 py-1 text-xs text-gray-600"
                                >
                                  {t("取消", "Cancel")}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => approveBill(b.id)}
                                className="rounded-md bg-green-700 px-2.5 py-1 text-xs font-semibold text-white"
                              >
                                ✅ {t("批准", "Approve")}
                              </button>
                              <button
                                onClick={() => setRejectingId(b.id)}
                                className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-semibold text-white"
                              >
                                ✗ {t("拒绝", "Reject")}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                      {role === "ADMIN" && b.status !== "PENDING_REVIEW" && b.type === "LATE_FEE" && (b.status === "PENDING" || b.status === "REJECTED") && (
                        <button
                          onClick={() => waiveLateFee(b.id)}
                          className="rounded-md bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-200"
                        >
                          🗑️ {t("撤销罚款", "Waive Penalty")}
                        </button>
                      )}
                      {b.status !== "PENDING_REVIEW" &&
                        !(role === "ADMIN" && b.type === "LATE_FEE" && (b.status === "PENDING" || b.status === "REJECTED")) && (
                        <span className="text-xs text-gray-400">{t("等租客上传", "Waiting for tenant to upload")}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}

      <b className="mt-3.5 block text-sm">📜 {t("收款历史", "Payment History")}</b>
      <table className="mt-1.5 w-full text-sm">
        <thead>
          <tr className="bg-gray-50 text-left text-gray-600">
            <th className="px-2.5 py-1.5 font-semibold">{t("项目", "Item")}</th>
            <th className="px-2.5 py-1.5 font-semibold">{t("金额", "Amount")}</th>
            <th className="px-2.5 py-1.5 font-semibold">{t("日期", "Date")}</th>
            <th className="px-2.5 py-1.5 font-semibold">{t("方式", "Method")}</th>
            <th className="px-2.5 py-1.5 font-semibold">{t("收据", "Receipt")}</th>
          </tr>
        </thead>
        <tbody>
          {paidHistory.length === 0 && (
            <tr>
              <td colSpan={5} className="py-3 text-center text-gray-400">
                {t("还没有收款记录", "No payment records yet")}
              </td>
            </tr>
          )}
          {paidHistory.map((p) => (
            <tr key={p.paymentCode} className="border-b border-gray-100">
              <td className="px-2.5 py-1.5">{paymentTypeLabelLocale(p.type, p.customLabel, locale)}</td>
              <td className="px-2.5 py-1.5">{fmt(p.amountPaid)}</td>
              <td className="px-2.5 py-1.5">
                {editingId === p.id ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="input h-7 py-0 text-xs"
                    />
                    <button
                      onClick={() => saveEditDate(p.id)}
                      disabled={editSaving}
                      className="rounded-md bg-green-700 px-2 py-1 text-xs font-semibold text-white"
                    >
                      ✓
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-600"
                    >
                      ✗
                    </button>
                  </div>
                ) : (
                  <span className="inline-flex items-center gap-1.5">
                    {fmtDate(p.paidDate)}
                    {role === "ADMIN" && (
                      <button
                        type="button"
                        onClick={() => startEditDate(p)}
                        className="text-xs text-gray-400 hover:text-brand"
                        title={t("改日期", "Edit Date")}
                      >
                        ✏️
                      </button>
                    )}
                  </span>
                )}
              </td>
              <td className="px-2.5 py-1.5">
                {editingId === p.id ? (
                  <select
                    value={editMethod}
                    onChange={(e) => setEditMethod(e.target.value)}
                    className="input h-7 py-0 text-xs"
                  >
                    <option>Bank Transfer</option>
                    <option>Cash</option>
                    <option>Cheque</option>
                  </select>
                ) : (
                  p.method || (p.receiptLink ? t("交易单上传", "Transaction Slip Uploaded") : "-")
                )}
              </td>
              <td className="px-2.5 py-1.5">
                <Link href={`/receipt/${p.paymentCode}`} target="_blank" className="text-xs font-semibold text-brand underline">
                  🧾 Receipt
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {zoomUrl && <Lightbox src={zoomUrl} alt={t("交易单", "Transaction Slip")} onClose={() => setZoomUrl(null)} />}
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
