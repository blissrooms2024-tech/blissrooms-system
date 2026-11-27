"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Pill from "@/components/Pill";
import Sheet from "@/components/Sheet";
import { useToast } from "@/components/Toast";
import { useLanguage } from "@/components/LanguageProvider";
import { IconAlert, IconCheck, IconSearch, IconX } from "@/components/icons";
import { paymentTypeLabelLocale } from "@/lib/config";
import { fmtDate, fmtMoney, isPdfUrl } from "@/lib/format";

/**
 * 交易单审核 — one card per uploaded slip, the slip itself big enough to check against the
 * bill (amount, reference, date). Tapping the slip opens it full-screen with 批准 / 拒绝 right
 * underneath, so a phone review is: look, tap, next. Rejecting asks for a reason the tenant
 * will see, with the common ones one tap away.
 */

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
  /** Full timestamp of the upload (paidDate is only the day). */
  uploadedAt: string | null;
}

// Uploads are timestamps; show them in Malaysia time whatever the device is set to.
const myTime = (iso: string) => {
  const s = new Date(new Date(iso).getTime() + 8 * 3600_000).toISOString();
  return { day: s.slice(0, 10), hm: s.slice(11, 16) };
};
const dayDiff = (later: string, earlier: string) => Math.round((Date.parse(later.slice(0, 10)) - Date.parse(earlier.slice(0, 10))) / 86_400_000);

export default function ReviewQueueClient({ canAct }: { canAct: boolean }) {
  const toast = useToast();
  const { locale, t } = useLanguage();
  const [items, setItems] = useState<PendingPayment[] | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [viewing, setViewing] = useState<PendingPayment | null>(null);
  const [rejecting, setRejecting] = useState<PendingPayment | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/payments/pending-review");
      const data = await res.json();
      if (!data.success) return setError(data.message);
      setError("");
      setItems(data.payments);
    } catch {
      setError(t("出错，请稍后再试", "Error — please try again later"));
    }
  }, [t]);

  useEffect(() => {
    // setState happens after the fetch's await, not synchronously in the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const label = (p: PendingPayment) =>
    p.type === "AC" && !p.periodMonth ? t("冷气充值", "A/C top-up") : paymentTypeLabelLocale(p.type, p.customLabel, locale);

  async function approve(p: PendingPayment) {
    setBusy(p.id);
    try {
      const res = await fetch(`/api/payments/${p.id}/approve`, { method: "POST" });
      const data = await res.json();
      if (data.success) toast.success(data.message);
      else toast.danger(data.message);
      setViewing(null);
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function reject() {
    if (!rejecting) return;
    if (!rejectReason.trim()) {
      toast.warning(t("请填拒绝原因", "Please enter a reason for rejecting"));
      return;
    }
    setBusy(rejecting.id);
    try {
      const res = await fetch(`/api/payments/${rejecting.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason.trim() }),
      });
      const data = await res.json();
      if (data.success) toast.success(data.message);
      else toast.danger(data.message);
      setRejecting(null);
      setRejectReason("");
      setViewing(null);
      await load();
    } finally {
      setBusy(null);
    }
  }

  const typeCounts = useMemo(() => {
    const m = new Map<string, { label: string; n: number }>();
    for (const p of items ?? []) {
      const key = p.type === "AC" && !p.periodMonth ? "AC_TOPUP" : p.type;
      m.set(key, { label: label(p), n: (m.get(key)?.n ?? 0) + 1 });
    }
    return [...m.entries()];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, locale]);

  const q = search.trim().toLowerCase();
  const shown = (items ?? []).filter((p) => {
    const key = p.type === "AC" && !p.periodMonth ? "AC_TOPUP" : p.type;
    if (typeFilter && key !== typeFilter) return false;
    return !q || p.contractCode.toLowerCase().includes(q) || p.roomCode.toLowerCase().includes(q) || (p.tenantName ?? "").toLowerCase().includes(q);
  });
  const total = (items ?? []).reduce((s, p) => s + p.amountPaid, 0);
  const today = myTime(new Date().toISOString()).day;
  const oldestWait = (items ?? []).reduce((m, p) => (p.uploadedAt ? Math.max(m, dayDiff(today, myTime(p.uploadedAt).day)) : m), 0);

  const quickReasons = [
    t("金额不对", "Wrong amount"),
    t("看不清楚，请重新上传", "Can't read it — please re-upload"),
    t("不是这笔账单的交易单", "Slip is for a different bill"),
    t("转账备注没写房号", "Room code missing from the reference"),
    t("重复上传", "Uploaded twice"),
  ];

  return (
    <div className="app-type mx-auto max-w-6xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">
          {t("交易单审核", "Payment slips")}
          {items && <span className="ml-1.5 text-base font-normal text-gray-400">{items.length}</span>}
        </h1>
        {items && items.length > 0 && (
          <p className="mt-0.5 text-sm text-gray-500">
            {t(`合计 ${fmtMoney(total)}`, `${fmtMoney(total)} in total`)}
            {oldestWait > 0 && <span className={oldestWait >= 2 ? "text-rose-600" : ""}>{t(` · 最早一张等了 ${oldestWait} 天`, ` · oldest waiting ${oldestWait} days`)}</span>}
          </p>
        )}
      </div>

      {/* The two halves of 收款: slips waiting for a decision, and bills nobody has paid yet. */}
      <nav className="grid max-w-sm grid-cols-2 rounded-xl bg-gray-200/60 p-1 text-sm font-medium">
        <span aria-current="page" className="rounded-lg bg-white py-2 text-center text-gray-900 shadow-sm">
          {t("待审核", "To review")} {items ? items.length : ""}
        </span>
        <Link href="/payments/outstanding" className="rounded-lg py-2 text-center text-gray-500 hover:text-gray-800">
          {t("未清账单", "Unpaid bills")}
        </Link>
      </nav>

      {items && items.length > 0 && (
        <>
          <div className="relative md:max-w-md">
            <IconSearch size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("搜房间 / 租客 / 合同号", "Search room, tenant, contract #")}
              className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-3 text-base shadow-sm placeholder:text-gray-400 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10 sm:text-sm"
            />
          </div>
          {typeCounts.length > 1 && (
            <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] sm:-mx-5 sm:px-5 md:mx-0 md:flex-wrap md:px-0">
              {[["", { label: t("全部", "All"), n: items.length }] as const, ...typeCounts].map(([key, v]) => (
                <button
                  key={key || "all"}
                  type="button"
                  aria-pressed={typeFilter === key}
                  onClick={() => setTypeFilter(key)}
                  className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium ${
                    typeFilter === key ? "bg-brand text-white" : "bg-white text-gray-700 shadow-sm hover:bg-gray-50"
                  }`}
                >
                  {v.label}
                  <span className={`text-xs ${typeFilter === key ? "text-white/80" : "text-gray-400"}`}>{v.n}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {error && <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
      {!items && !error && (
        <ul className="space-y-3">
          {[0, 1].map((i) => (
            <li key={i} className="h-48 animate-pulse rounded-[20px] bg-white/80 motion-reduce:animate-none" />
          ))}
        </ul>
      )}
      {items && items.length === 0 && (
        <div className="rounded-[20px] bg-white px-6 py-12 text-center shadow-sm">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-teal-50 text-teal-600">
            <IconCheck size={26} />
          </span>
          <p className="mt-3 font-medium text-gray-900">{t("全部审核完了", "All caught up")}</p>
          <p className="mt-1 text-sm text-gray-500">{t("租客上传新的交易单时，这里会出现。", "New slips from tenants will show up here.")}</p>
        </div>
      )}
      {items && items.length > 0 && shown.length === 0 && <p className="py-8 text-center text-sm text-gray-400">{t("没有符合条件的交易单", "No slips match")}</p>}

      <ul className="grid gap-3 lg:grid-cols-2">
        {shown.map((p) => {
          const up = p.uploadedAt ? myTime(p.uploadedAt) : null;
          const late = up && p.dueDate ? dayDiff(up.day, p.dueDate) : 0;
          const topup = p.type === "AC" && !p.periodMonth;
          return (
            <li key={p.id} className="rounded-[20px] bg-white p-3.5 shadow-[0_1px_2px_rgba(30,27,46,0.04),0_12px_28px_-18px_rgba(76,29,149,0.22)]">
              <div className="flex gap-3.5">
                {p.receiptLink ? (
                  <button
                    type="button"
                    onClick={() => setViewing(p)}
                    aria-label={t("放大看交易单", "Open the slip")}
                    className="relative h-[124px] w-[92px] shrink-0 overflow-hidden rounded-xl bg-gray-100 ring-1 ring-black/5"
                  >
                    {isPdfUrl(p.receiptLink) ? (
                      // Banking apps often give a PDF; browsers show those natively, full screen.
                      <span className="grid h-full w-full place-items-center bg-rose-50 text-center">
                        <span>
                          <b className="block text-lg text-rose-700">PDF</b>
                          <span className="text-[11px] text-rose-700/80">{t("点我打开", "Tap to open")}</span>
                        </span>
                      </span>
                    ) : (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.receiptLink} alt={t("交易单", "Payment slip")} className="h-full w-full object-cover object-top" />
                        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent pb-1 pt-4 text-center text-[11px] font-medium text-white">
                          {t("点我放大", "Tap to view")}
                        </span>
                      </>
                    )}
                  </button>
                ) : (
                  <div className="grid h-[124px] w-[92px] shrink-0 place-items-center rounded-xl bg-gray-50 px-2 text-center text-[11px] text-gray-400 ring-1 ring-black/5">
                    {t("没有交易单", "No slip")}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="flex items-baseline gap-2">
                    <b className="shrink-0 text-base font-semibold text-gray-900">{p.roomCode}</b>
                    <span className="truncate text-sm text-gray-700">{p.tenantName}</span>
                  </p>
                  <Link href={`/contracts/${p.contractCode}`} className="text-xs text-gray-400 hover:text-brand hover:underline">
                    {p.contractCode}
                  </Link>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <Pill tone={topup ? "blue" : "violet"}>{label(p)}</Pill>
                    {p.periodMonth && <span className="text-xs text-gray-500">{p.periodMonth}</span>}
                  </div>
                  <p className="mt-1.5 text-xl font-semibold leading-tight text-gray-900">{fmtMoney(p.amountPaid)}</p>
                  <p className="mt-0.5 text-[11px] text-gray-500">
                    {up ? t(`上传 ${fmtDate(up.day)} ${up.hm}`, `Uploaded ${fmtDate(up.day)} ${up.hm}`) : t("还没上传时间", "No upload time")}
                    {late > 0 && <span className="font-medium text-rose-600">{t(` · 迟了 ${late} 天`, ` · ${late} days late`)}</span>}
                  </p>
                </div>
              </div>

              {topup && (
                <p className="mt-3 flex gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <IconAlert size={16} className="mt-px shrink-0" />
                  {t("批准后 12 小时内更新到 Smart Meter（只在周一至五）", "Once approved, top up the Smart Meter within 12 hours (weekdays only)")}
                </p>
              )}

              {canAct && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => setRejecting(p)}
                    className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-rose-50 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                  >
                    <IconX size={17} />
                    {t("拒绝", "Reject")}
                  </button>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => approve(p)}
                    className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-teal-600 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
                  >
                    <IconCheck size={17} />
                    {busy === p.id ? t("处理中…", "Working…") : t("批准", "Approve")}
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {/* Full-screen slip, with the decision right under it */}
      {viewing && viewing.receiptLink && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-[#0f0d17]" role="dialog" aria-modal="true" aria-label={t("交易单", "Payment slip")}>
          <div className="flex items-center justify-between gap-3 px-4 pb-2 text-white" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {viewing.roomCode} · {viewing.tenantName}
              </p>
              <p className="text-xs text-white/60">
                {label(viewing)} · {fmtMoney(viewing.amountPaid)}
              </p>
            </div>
            <button type="button" onClick={() => setViewing(null)} aria-label={t("关闭", "Close")} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 hover:bg-white/20">
              <IconX size={20} />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto px-3">
            {isPdfUrl(viewing.receiptLink) ? (
              <div className="flex h-full flex-col gap-3">
                <iframe src={viewing.receiptLink} title={t("交易单 PDF", "Payment slip PDF")} className="min-h-0 w-full flex-1 rounded-xl bg-white" />
                <a href={viewing.receiptLink} target="_blank" rel="noopener noreferrer" className="block rounded-xl bg-white/10 py-2.5 text-center text-sm font-semibold text-white hover:bg-white/20">
                  {t("看不到？在新页面打开 PDF", "Can't see it? Open the PDF in a new tab")}
                </a>
              </div>
            ) : (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={viewing.receiptLink} alt={t("交易单", "Payment slip")} className="mx-auto h-full w-full object-contain" />
              </>
            )}
          </div>
          {canAct && (
            <div className="grid grid-cols-2 gap-2 px-4 pt-3" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => {
                  // The reason sheet sits under this full-screen view, so step out of it first.
                  setRejecting(viewing);
                  setViewing(null);
                }}
                className="flex h-12 items-center justify-center gap-1.5 rounded-xl bg-white/10 text-sm font-semibold text-white hover:bg-white/20 disabled:opacity-50"
              >
                <IconX size={18} />
                {t("拒绝", "Reject")}
              </button>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => approve(viewing)}
                className="flex h-12 items-center justify-center gap-1.5 rounded-xl bg-teal-500 text-sm font-semibold text-white hover:bg-teal-600 disabled:opacity-50"
              >
                <IconCheck size={18} />
                {busy === viewing.id ? t("处理中…", "Working…") : t(`批准 ${fmtMoney(viewing.amountPaid)}`, `Approve ${fmtMoney(viewing.amountPaid)}`)}
              </button>
            </div>
          )}
        </div>
      )}

      <Sheet
        open={!!rejecting}
        onClose={() => {
          if (busy) return;
          setRejecting(null);
          setRejectReason("");
        }}
        title={t("拒绝这张交易单", "Reject this slip")}
      >
        {rejecting && (
          <>
            <p className="text-sm text-gray-600">
              {rejecting.roomCode} · {rejecting.tenantName} · {label(rejecting)} {fmtMoney(rejecting.amountPaid)}
            </p>
            <p className="mb-1.5 mt-4 text-sm font-medium text-gray-700">{t("原因（租客会看到）", "Reason (the tenant will see this)")}</p>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {quickReasons.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRejectReason(r)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium ${rejectReason === r ? "bg-rose-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                >
                  {r}
                </button>
              ))}
            </div>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              placeholder={t("或自己写原因…", "Or write your own…")}
              className="input"
            />
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setRejecting(null);
                  setRejectReason("");
                }}
                className="btn-soft py-2.5"
              >
                {t("取消", "Cancel")}
              </button>
              <button type="button" disabled={busy !== null} onClick={reject} className="rounded-lg bg-rose-600 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50">
                {busy === rejecting.id ? t("处理中…", "Working…") : t("确定拒绝", "Reject")}
              </button>
            </div>
          </>
        )}
      </Sheet>
    </div>
  );
}
