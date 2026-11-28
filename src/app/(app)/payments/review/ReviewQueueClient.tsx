"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Sheet from "@/components/Sheet";
import { useToast } from "@/components/Toast";
import { useLanguage } from "@/components/LanguageProvider";
import { IconAlert, IconCheck, IconClock, IconRefresh, IconSearch, IconX } from "@/components/icons";
import { paymentTypeLabelLocale } from "@/lib/config";
import { fmtDate, fmtMoney, isPdfUrl } from "@/lib/format";
import PaymentsTabs from "../PaymentsTabs";

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

/** Room codes are "{unit}-01", "{unit}-CP01"…, so a unit's bills are the ones whose room starts with its code. */
const inUnit = (roomCode: string, unit: string) => roomCode === unit || roomCode.startsWith(`${unit}-`);

/** `propertyCode` + `embedded`: the 账单 tab on a unit's page — that unit's slips only, without the
 * 待审核 / 未清账单 switch (the tab has its own). */
export default function ReviewQueueClient({ canAct, propertyCode, embedded = false }: { canAct: boolean; propertyCode?: string; embedded?: boolean }) {
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
      setItems(propertyCode ? data.payments.filter((x: PendingPayment) => inUnit(x.roomCode, propertyCode)) : data.payments);
    } catch {
      setError(t("出错，请稍后再试", "Error — please try again later"));
    }
  }, [t, propertyCode]);

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
      if (data.success)
        toast.success(
          p.type === "AC" && !p.periodMonth
            ? `${data.message}${t(" · 记得 12 小时内更新 Smart Meter", " · top up the Smart Meter within 12 hours")}`
            : data.message
        );
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
    <div className="app-type mx-auto max-w-6xl space-y-3">
      {/* The 待审核 / 未清账单 switch doubles as the page title, so the list starts higher. */}
      {!embedded && <h1 className="sr-only">{t("交易单审核", "Payment slips")}</h1>}
      <div className="space-y-1.5">
        {!embedded && <PaymentsTabs current="review" reviewCount={items?.length} />}
        {items && items.length > 0 && (
          <p className="px-1 text-xs text-gray-500">
            {t(`合计 ${fmtMoney(total)}`, `${fmtMoney(total)} in total`)}
            {oldestWait > 0 && <span className={oldestWait >= 2 ? "font-medium text-rose-600" : ""}>{t(` · 最早一张等了 ${oldestWait} 天`, ` · oldest waiting ${oldestWait} days`)}</span>}
          </p>
        )}
      </div>

      {items && items.length > 0 && (
        <>
          <div className="relative md:max-w-md">
            <IconSearch size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("搜房间 / 租客 / 合同号", "Room, tenant, contract #")}
              className="h-10 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-10 text-base shadow-sm placeholder:text-gray-400 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10 sm:text-sm"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label={t("清除搜索", "Clear search")}
                className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-gray-400 hover:bg-gray-100"
              >
                <IconX size={16} />
              </button>
            )}
          </div>
          {typeCounts.length > 1 && (
            <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] sm:-mx-5 sm:px-5 md:mx-0 md:flex-wrap md:px-0">
              {[["", { label: t("全部", "All"), n: items.length }] as const, ...typeCounts].map(([key, v]) => (
                <button
                  key={key || "all"}
                  type="button"
                  aria-pressed={typeFilter === key}
                  onClick={() => setTypeFilter(key)}
                  className={`flex h-8 shrink-0 items-center gap-1 rounded-full px-3 text-[13px] font-medium ${
                    typeFilter === key ? "bg-brand text-white" : "bg-white text-gray-700 shadow-sm hover:bg-gray-50"
                  }`}
                >
                  {v.label}
                  <span className={`text-[11px] ${typeFilter === key ? "text-white/80" : "text-gray-400"}`}>{v.n}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {error && <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
      {!items && !error && (
        <ul className="space-y-2">
          {[0, 1, 2].map((i) => (
            <li key={i} className="h-[72px] animate-pulse rounded-2xl bg-white/80 motion-reduce:animate-none" />
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

      {/* Two short lines per slip, like the contract and room cards: who and how much, then
          what it's for with the decision beside it. The small slip opens full-screen. */}
      <ul className="grid grid-cols-1 gap-2 lg:grid-cols-2">
        {shown.map((p) => {
          const up = p.uploadedAt ? myTime(p.uploadedAt) : null;
          const late = up && p.dueDate ? dayDiff(up.day, p.dueDate) : 0;
          const topup = p.type === "AC" && !p.periodMonth;
          return (
            <li key={p.id} className="flex min-w-0 gap-2.5 rounded-2xl bg-white p-2 shadow-[0_1px_2px_rgba(30,27,46,0.05)]">
              {p.receiptLink ? (
                <button
                  type="button"
                  onClick={() => setViewing(p)}
                  aria-label={t("放大看交易单", "Open the slip")}
                  className="h-14 w-11 shrink-0 overflow-hidden rounded-lg bg-gray-100 ring-1 ring-black/5"
                >
                  {isPdfUrl(p.receiptLink) ? (
                    // Banking apps often give a PDF; browsers show those natively, full screen.
                    <span className="grid h-full w-full place-items-center bg-rose-50 text-[11px] font-bold text-rose-700">PDF</span>
                  ) : (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.receiptLink} alt={t("交易单", "Payment slip")} className="h-full w-full object-cover object-top" />
                    </>
                  )}
                </button>
              ) : (
                <div className="grid h-14 w-11 shrink-0 place-items-center rounded-lg bg-gray-50 px-0.5 text-center text-[10px] leading-tight text-gray-400 ring-1 ring-black/5">
                  {t("没有交易单", "No slip")}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <Link href={`/contracts/${p.contractCode}`} className="flex min-w-0 items-baseline gap-1.5">
                    <b className="shrink-0 text-[15px] font-semibold text-gray-900">{p.roomCode}</b>
                    <span className="truncate text-[13px] text-gray-700">{p.tenantName}</span>
                  </Link>
                  <b className="shrink-0 whitespace-nowrap text-[15px] font-semibold tabular-nums text-gray-900">{fmtMoney(p.amountPaid)}</b>
                </div>
                <div className="mt-0.5 flex items-center justify-between gap-2">
                  <div className="min-w-0 text-[11.5px] leading-4 text-gray-400">
                    <p className={`truncate font-medium ${topup ? "text-sky-700" : "text-brand"}`}>
                      {label(p)}
                      {p.periodMonth && <span className="font-normal text-gray-500"> {p.periodMonth}</span>}
                    </p>
                    {topup ? (
                      <p className="truncate font-medium text-amber-700">
                        {t("12 小时内更新 Smart Meter", "Top up Smart Meter within 12h")}
                      </p>
                    ) : (
                      <p className="truncate">
                        {late > 0 && <span className="font-medium text-rose-600">{t(`迟了 ${late} 天 · `, `${late}d late · `)}</span>}
                        <span className="sr-only">{t("上传 ", "Uploaded ")}</span>
                        <IconClock size={11} className="-mt-0.5 mr-0.5 inline" />
                        {up ? `${fmtDate(up.day).slice(0, 5)} ${up.hm}` : t("没有时间", "no time")} · {p.contractCode}
                      </p>
                    )}
                  </div>
                  {canAct && (
                    <div className="flex shrink-0 gap-1.5">
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() => setRejecting(p)}
                        aria-label={t("拒绝", "Reject")}
                        title={t("拒绝", "Reject")}
                        className="grid h-8 w-8 place-items-center rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                      >
                        <IconX size={16} />
                      </button>
                      {/* Icons only, so what the slip is for keeps the room (the full-screen view
                          spells both out). */}
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() => approve(p)}
                        aria-label={t(`批准 ${fmtMoney(p.amountPaid)}`, `Approve ${fmtMoney(p.amountPaid)}`)}
                        title={t("批准", "Approve")}
                        className="grid h-8 w-10 place-items-center rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50"
                      >
                        {busy === p.id ? <IconRefresh size={16} className="animate-spin motion-reduce:animate-none" /> : <IconCheck size={18} />}
                      </button>
                    </div>
                  )}
                </div>
              </div>
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
          {viewing.type === "AC" && !viewing.periodMonth && (
            <p className="mx-4 mt-3 flex items-center gap-1.5 rounded-lg bg-amber-400/15 px-3 py-2 text-xs text-amber-200">
              <IconAlert size={14} className="shrink-0" />
              {t("批准后 12 小时内更新到 Smart Meter（只在周一至五）", "Once approved, top up the Smart Meter within 12 hours (weekdays only)")}
            </p>
          )}
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
