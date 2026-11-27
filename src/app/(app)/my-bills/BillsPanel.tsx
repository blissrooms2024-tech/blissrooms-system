"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Lightbox from "@/components/Lightbox";
import StepTimeline, { TimelineStep } from "@/components/StepTimeline";
import { useToast } from "@/components/Toast";
import { useLanguage } from "@/components/LanguageProvider";
import { paymentTypeLabelLocale } from "@/lib/config";
import { fmtDate, fmtMoney as fmt } from "@/lib/format";
import BreakdownPayAllModal from "./BreakdownPayAllModal";
import { compressImageToDataUrl } from "@/lib/compressImage";

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


const BILL_FLOW = ["PENDING", "PENDING_REVIEW", "Paid"];

function buildBillSteps(b: PaymentRow, t: (zh: string, en: string) => string): TimelineStep[] {
  if (b.status === "REJECTED") {
    return [
      { label: t("账单已开", "Bill Issued"), state: "done" },
      { label: t("已上传交易单", "Slip Uploaded"), state: "done" },
      { label: t("已拒绝", "Rejected"), sublabel: b.reviewNote ?? undefined, state: "rejected" },
    ];
  }
  const currentIndex = BILL_FLOW.indexOf(b.status);
  return [
    { label: t("账单已开", "Bill Issued"), state: 0 < currentIndex ? "done" : currentIndex === 0 ? "active" : "pending" },
    {
      label: t("已上传交易单", "Slip Uploaded"),
      sublabel: b.paidDate ? fmtDate(b.paidDate) : undefined,
      state: 1 < currentIndex ? "done" : currentIndex === 1 ? "active" : "pending",
    },
    { label: t("已批准", "Approved"), state: currentIndex === 2 ? "done" : "pending" },
  ];
}

export default function BillsPanel({ contractCode }: { contractCode: string }) {
  const toast = useToast();
  const { locale, t } = useLanguage();
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [breakdown, setBreakdown] = useState<BreakdownRow[]>([]);
  const [totals, setTotals] = useState({ due: 0, paid: 0, outstanding: 0 });
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);
  const [payingAll, setPayingAll] = useState(false);

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
    if (!file.type.startsWith("image/") && file.size > 3 * 1024 * 1024) {
      toast.warning(t("文件太大(超过3MB)", "File too large (over 3MB)"));
      return;
    }
    setUploadingId(paymentId);
    try {
      const dataUrl = await compressImageToDataUrl(file);
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
      toast.danger(t("系统出错，请稍后再试", "System error — please try again later"));
    } finally {
      setUploadingId(null);
    }
  }

  const actionable = payments.filter((p) => p.status !== "Paid");
  const paidHistory = payments.filter((p) => p.status === "Paid");
  // Only an item with its own Admin-opened bill (PENDING) or a rejected one (REJECTED) is
  // excluded here — those already have a single-item upload widget below. An item that's
  // PENDING_REVIEW (tenant already paid, waiting on Admin) stays payable so tenants can pay
  // ahead / top up the rest without the button vanishing while the earlier slip is reviewed.
  const blockedTypes = new Set(actionable.filter((p) => p.status === "PENDING" || p.status === "REJECTED").map((p) => p.type));
  const payableItems = breakdown.filter((b) => b.outstanding > 0 && !blockedTypes.has(b.item));
  const payableTotal = payableItems.reduce((s, b) => s + b.outstanding, 0);

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm sm:p-5">
      <h3 className="text-base font-bold text-brand sm:text-lg">
        {t("💳 我的账单", "💳 My Bills")} — {contractCode}
      </h3>

      <div className="my-3">
        <Box label={t("还欠", "Outstanding")} value={fmt(totals.outstanding)} color="text-red-600" />
      </div>

      {breakdown.length > 0 && (
        <>
          <b className="mb-1.5 block text-sm">{t("🧾 费用明细", "🧾 Fee Breakdown")}</b>
          {/* Phone: one compact row per item instead of a 4-column table. */}
          <div className="mb-3.5 divide-y divide-gray-100 rounded-lg border border-gray-200 sm:hidden">
            {breakdown.map((b) => (
              <div key={b.item} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <div className="font-medium">{paymentTypeLabelLocale(b.item, null, locale)}</div>
                  <div className="text-xs text-gray-500">
                    {t("应收", "Due")} {fmt(b.due)} · {t("已收", "Paid")} {fmt(b.paid)}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  {b.outstanding > 0 ? (
                    <span className="font-semibold text-red-600">{fmt(b.outstanding)}</span>
                  ) : (
                    <span className="text-green-700">{t("✅清", "✅ Settled")}</span>
                  )}
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between gap-3 bg-gray-50 px-3 py-3 text-sm font-semibold">
              <div className="min-w-0">
                <div className="text-xs font-normal text-gray-500">{t("还欠总额 (未开账单项目)", "Total Outstanding (Not Yet Billed)")}</div>
                <div className={payableTotal > 0 ? "text-red-600" : "text-gray-400"}>{fmt(payableTotal)}</div>
              </div>
              <button
                type="button"
                onClick={() => setPayingAll(true)}
                className="shrink-0 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark"
              >
                {t("付款", "Pay")}
              </button>
            </div>
          </div>
          <table className="mb-3.5 hidden w-full text-sm sm:table">
            <thead>
              <tr className="bg-gray-50 text-left text-gray-600">
                <th className="px-2.5 py-1.5 font-semibold">{t("项目", "Item")}</th>
                <th className="px-2.5 py-1.5 font-semibold">{t("应收", "Due")}</th>
                <th className="px-2.5 py-1.5 font-semibold">{t("已收", "Paid")}</th>
                <th className="px-2.5 py-1.5 font-semibold">{t("还欠", "Outstanding")}</th>
              </tr>
            </thead>
            <tbody>
              {breakdown.map((b) => (
                <tr key={b.item} className="border-b border-gray-100">
                  <td className="px-2.5 py-1.5">{paymentTypeLabelLocale(b.item, null, locale)}</td>
                  <td className="px-2.5 py-1.5">{fmt(b.due)}</td>
                  <td className="px-2.5 py-1.5">{fmt(b.paid)}</td>
                  <td className="px-2.5 py-1.5">
                    {b.outstanding > 0 ? (
                      <span className="font-semibold text-red-600">{fmt(b.outstanding)}</span>
                    ) : (
                      <span className="text-green-700">{t("✅清", "✅ Settled")}</span>
                    )}
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
                <td className="px-2.5 py-1.5" colSpan={3}>
                  {t("还欠总额 (未开账单项目)", "Total Outstanding (Not Yet Billed)")}
                </td>
                <td className="px-2.5 py-1.5">
                  <span className="flex items-center gap-1.5">
                    <span className={payableTotal > 0 ? "text-red-600" : "text-gray-400"}>{fmt(payableTotal)}</span>
                    <button
                      type="button"
                      onClick={() => setPayingAll(true)}
                      className="rounded-full bg-brand px-2.5 py-0.5 text-xs font-semibold text-white hover:bg-brand-dark"
                    >
                      {t("付款", "Pay")}
                    </button>
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </>
      )}

      {actionable.length > 0 && (
        <>
          <b className="mb-1.5 block text-sm">
            {t("📋 待处理账单", "📋 Pending Bills")} ({actionable.length})
          </b>
          <div className="space-y-2.5">
            {actionable.map((b) => {
              return (
                <div key={b.id} className="rounded-lg border border-gray-200 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-[160px] flex-1">
                      <b className="text-sm">{paymentTypeLabelLocale(b.type, b.customLabel, locale)}</b>{" "}
                      <span className="text-sm text-gray-600">{fmt(b.amountDue)}</span>
                      {b.periodMonth && <span className="ml-1.5 text-xs text-gray-400">({b.periodMonth})</span>}
                      <div className="text-xs text-gray-500">
                        {t("到期日", "Due Date")}: {fmtDate(b.dueDate)}
                      </div>
                      <Link
                        href={`/invoice/${b.paymentCode}`}
                        target="_blank"
                        className="mt-1 inline-block py-1 text-xs font-semibold text-brand underline"
                      >
                        {t("📄 查看正式 Invoice", "📄 View Official Invoice")}
                      </Link>
                    </div>
                    <div className="w-full sm:w-auto sm:min-w-[150px]">
                      <StepTimeline steps={buildBillSteps(b, t)} />
                    </div>
                  </div>
                  {b.status === "PENDING_REVIEW" && b.receiptLink && (
                    <button
                      type="button"
                      onClick={() => setZoomUrl(b.receiptLink)}
                      className="mt-2 py-1 text-xs font-semibold text-brand underline"
                    >
                      {t("🧾 查看已上传的交易单", "🧾 View Uploaded Slip")}
                    </button>
                  )}
                  {(b.status === "PENDING" || b.status === "REJECTED") && (
                    <div className="mt-2">
                      <input
                        type="file"
                        accept="image/*"
                        disabled={uploadingId === b.id}
                        onChange={(e) => e.target.files?.[0] && uploadSlip(b.id, e.target.files[0])}
                        className="block w-full text-sm text-gray-500 file:mr-3 file:py-2.5 sm:file:py-2 file:cursor-pointer file:rounded-lg file:border-0 file:bg-brand file:px-3.5 file:text-sm file:font-semibold file:text-white hover:file:bg-brand-dark disabled:opacity-50"
                      />
                      {uploadingId === b.id && <span className="ml-2 text-sm text-gray-500">{t("上传中...", "Uploading...")}</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      <b className="mt-3.5 block text-sm">
        {t("📜 已付款记录", "📜 Payment History")} ({paidHistory.length})
      </b>
      {/* Phone: payment history as cards. */}
      <div className="mt-1.5 space-y-2 sm:hidden">
        {paidHistory.length === 0 && <div className="py-3 text-center text-sm text-gray-400">{t("还没有付款记录", "No payment history yet")}</div>}
        {paidHistory.map((p) => (
          <div key={p.paymentCode} className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2.5 text-sm">
            <div className="min-w-0">
              <div className="font-medium">
                {paymentTypeLabelLocale(p.type, p.customLabel, locale)}
                {p.periodMonth && <span className="text-gray-400"> ({p.periodMonth})</span>}
              </div>
              <div className="text-xs text-gray-500">
                {fmt(p.amountPaid)} · {fmtDate(p.paidDate)}
              </div>
            </div>
            <Link
              href={`/receipt/${p.paymentCode}`}
              target="_blank"
              className="shrink-0 rounded-lg bg-brand-light px-3 py-2 text-xs font-semibold text-brand"
            >
              {t("🧾 收据", "🧾 Receipt")}
            </Link>
          </div>
        ))}
      </div>
      <table className="mt-1.5 hidden w-full text-sm sm:table">
        <thead>
          <tr className="bg-gray-50 text-left text-gray-600">
            <th className="px-2.5 py-1.5 font-semibold">{t("项目", "Item")}</th>
            <th className="px-2.5 py-1.5 font-semibold">{t("金额", "Amount")}</th>
            <th className="px-2.5 py-1.5 font-semibold">{t("日期", "Date")}</th>
            <th className="px-2.5 py-1.5 font-semibold">{t("收据", "Receipt")}</th>
          </tr>
        </thead>
        <tbody>
          {paidHistory.length === 0 && (
            <tr>
              <td colSpan={4} className="py-3 text-center text-gray-400">
                {t("还没有付款记录", "No payment history yet")}
              </td>
            </tr>
          )}
          {paidHistory.map((p) => (
            <tr key={p.paymentCode} className="border-b border-gray-100">
              <td className="px-2.5 py-1.5">
                {paymentTypeLabelLocale(p.type, p.customLabel, locale)}
                {p.periodMonth && <span className="text-gray-400"> ({p.periodMonth})</span>}
              </td>
              <td className="px-2.5 py-1.5">{fmt(p.amountPaid)}</td>
              <td className="px-2.5 py-1.5">{fmtDate(p.paidDate)}</td>
              <td className="px-2.5 py-1.5">
                <Link href={`/receipt/${p.paymentCode}`} target="_blank" className="text-xs font-semibold text-brand underline">
                  {t("🧾 查看 Receipt", "🧾 View Receipt")}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {zoomUrl && <Lightbox src={zoomUrl} alt={t("交易单", "Transaction Slip")} onClose={() => setZoomUrl(null)} />}

      {payingAll && (
        <BreakdownPayAllModal
          contractCode={contractCode}
          items={payableItems.map((b) => ({ item: b.item, outstanding: b.outstanding }))}
          total={payableTotal}
          onClose={() => setPayingAll(false)}
          onPaid={load}
        />
      )}
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
