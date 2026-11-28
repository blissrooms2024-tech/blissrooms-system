"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { paymentTypeLabelLocale } from "@/lib/config";
import { fmtDate, fmtMoney as fmt } from "@/lib/format";
import { useLanguage } from "@/components/LanguageProvider";
import { useToast } from "@/components/Toast";
import ConfirmDialog from "@/components/ConfirmDialog";
import Pill, { PILL, type PillTone } from "@/components/Pill";
import { IconCheck, IconSearch, IconTrash, IconX } from "@/components/icons";
import PaymentsTabs from "../PaymentsTabs";

interface Bill {
  id: string;
  paymentCode: string;
  contractCode: string;
  roomCode: string;
  tenantName: string | null;
  type: string;
  status: string;
  amountDue: number;
  amountPaid: number;
  periodMonth: string | null;
  dueDate: string | null;
  submittedDate: string | null;
  reviewNote: string | null;
  customLabel: string | null;
}

const STATUS_BADGE: Record<string, { zh: string; en: string; tone: PillTone }> = {
  PENDING: { zh: "等租客上传", en: "Awaiting slip", tone: "gray" },
  PENDING_REVIEW: { zh: "待审核", en: "To review", tone: "amber" },
  REJECTED: { zh: "被拒绝，待重传", en: "Rejected", tone: "rose" },
};
type StatusKey = "" | "OVERDUE" | "PENDING" | "PENDING_REVIEW" | "REJECTED";

// Malaysia's calendar day whatever the device is set to. Overdue = still on the tenant
// (not uploaded, or rejected) after the due date — the same rule as the home page's count.
const todayMY = () => new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
const overdueDays = (p: Bill, today: string) =>
  (p.status === "PENDING" || p.status === "REJECTED") && p.dueDate && p.dueDate.slice(0, 10) < today
    ? Math.round((Date.parse(today) - Date.parse(p.dueDate.slice(0, 10))) / 86_400_000)
    : 0;
// A/C top-ups are their own thing to the tenant, so they get their own filter.
const typeKey = (p: Bill) => (p.type === "AC" && !p.periodMonth ? "AC_TOPUP" : p.type);

export default function OutstandingBillsClient({ initialShow }: { initialShow?: "overdue" }) {
  const { locale, t } = useLanguage();
  const toast = useToast();
  const [items, setItems] = useState<Bill[] | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusKey>(initialShow === "overdue" ? "OVERDUE" : "");
  const [today] = useState(todayMY);
  const [deletingBill, setDeletingBill] = useState<Bill | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

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
      setError(t("出错，请稍后再试", "Error — please try again later"));
    }
  }, [t]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function deleteBill(id: string) {
    const res = await fetch(`/api/payments/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (data.success) toast.success(data.message);
    else toast.danger(data.message);
    setDeletingBill(null);
    load();
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function bulkDelete() {
    setBulkDeleting(true);
    try {
      const ids = Array.from(selectedIds);
      const results = await Promise.all(
        ids.map((id) => fetch(`/api/payments/${id}`, { method: "DELETE" }).then((r) => r.json()))
      );
      const okCount = results.filter((r) => r.success).length;
      const failCount = results.length - okCount;
      if (failCount === 0) {
        toast.success(t(`✅ 已删除 ${okCount} 笔账单`, `✅ Deleted ${okCount} bills`));
      } else {
        toast.danger(
          t(`删除了 ${okCount} 笔，${failCount} 笔失败`, `Deleted ${okCount}, ${failCount} failed`)
        );
      }
    } finally {
      setBulkDeleting(false);
      setBulkConfirmOpen(false);
      setSelectedIds(new Set());
      load();
    }
  }

  const label = (p: Bill) => (typeKey(p) === "AC_TOPUP" ? t("冷气充值", "A/C top-up") : paymentTypeLabelLocale(p.type, p.customLabel, locale));
  const typeName = (k: string) => (k === "AC_TOPUP" ? t("冷气充值", "A/C top-up") : paymentTypeLabelLocale(k, undefined, locale));
  const badgeOf = (p: Bill) => {
    const d = STATUS_BADGE[p.status];
    return d ? { label: t(d.zh, d.en), tone: d.tone } : { label: p.status, tone: "gray" as PillTone };
  };

  // Search, status and item combine; each chip counts what it would show with the other
  // filters as they are.
  const all = items ?? [];
  const q = search.trim().toLowerCase();
  const matchesQ = (p: Bill) =>
    !q || p.contractCode.toLowerCase().includes(q) || p.roomCode.toLowerCase().includes(q) || (p.tenantName ?? "").toLowerCase().includes(q);
  const matchesStatus = (p: Bill) => !statusFilter || (statusFilter === "OVERDUE" ? overdueDays(p, today) > 0 : p.status === statusFilter);
  const matchesType = (p: Bill) => !typeFilter || typeKey(p) === typeFilter;
  const filteredBills = all.filter((p) => matchesQ(p) && matchesStatus(p) && matchesType(p));
  const statusBase = all.filter((p) => matchesQ(p) && matchesType(p));
  const statusCount = (k: StatusKey) =>
    !k ? statusBase.length : k === "OVERDUE" ? statusBase.filter((p) => overdueDays(p, today) > 0).length : statusBase.filter((p) => p.status === k).length;
  const typeCounts = new Map<string, number>();
  for (const p of all) if (matchesQ(p) && matchesStatus(p)) typeCounts.set(typeKey(p), (typeCounts.get(typeKey(p)) ?? 0) + 1);
  const typeKeys = [...new Set([...all.map(typeKey), ...(typeFilter ? [typeFilter] : [])])];
  const isFiltered = !!(q || statusFilter || typeFilter);

  const totalDue = all.reduce((sum, p) => sum + p.amountDue, 0);
  const overdueBills = all.filter((p) => overdueDays(p, today) > 0);
  const overdueAmount = overdueBills.reduce((sum, p) => sum + p.amountDue, 0);
  const reviewCount = all.filter((p) => p.status === "PENDING_REVIEW").length;
  const selectedPendingReviewCount = all.filter((p) => selectedIds.has(p.id) && p.status === "PENDING_REVIEW").length;

  const chip = (on: boolean) =>
    `flex h-8 shrink-0 items-center gap-1 rounded-full px-3 text-[13px] font-medium transition-colors ${
      on ? "bg-brand text-white" : "bg-white text-gray-700 shadow-sm hover:bg-gray-50"
    }`;
  const STATUS_CHIPS: { k: StatusKey; zh: string; en: string }[] = [
    { k: "", zh: "全部", en: "All" },
    { k: "OVERDUE", zh: "逾期", en: "Overdue" },
    { k: "PENDING", zh: "等租客上传", en: "Awaiting slip" },
    { k: "PENDING_REVIEW", zh: "待审核", en: "To review" },
    { k: "REJECTED", zh: "被拒绝", en: "Rejected" },
  ];

  return (
    <div className="app-type mx-auto max-w-6xl space-y-3">
      {/* The 待审核 / 未清账单 switch doubles as the page title, so the list starts higher. */}
      <h1 className="sr-only">{t("未清账单", "Unpaid bills")}</h1>
      <div className="space-y-1.5">
        <PaymentsTabs current="unpaid" reviewCount={items ? reviewCount : undefined} unpaidCount={items?.length} />
        {items && items.length > 0 && (
          <p className="px-1 text-xs text-gray-500">
            {t(`合计 ${fmt(totalDue)}`, `${fmt(totalDue)} in total`)}
            {overdueBills.length > 0 && (
              <span className="font-medium text-rose-600">
                {t(` · 逾期 ${overdueBills.length} 张 ${fmt(overdueAmount)}`, ` · ${overdueBills.length} overdue, ${fmt(overdueAmount)}`)}
              </span>
            )}
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

          <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] sm:-mx-5 sm:px-5 md:mx-0 md:flex-wrap md:px-0">
            {STATUS_CHIPS.filter((c) => c.k === "" || c.k === statusFilter || statusCount(c.k) > 0).map((c) => {
              const on = statusFilter === c.k && !(c.k === "" && typeFilter);
              const n = c.k === "" ? all.filter(matchesQ).length : statusCount(c.k);
              return (
                <button
                  key={c.k || "all"}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    if (c.k === "") {
                      setStatusFilter("");
                      setTypeFilter("");
                    } else setStatusFilter(statusFilter === c.k ? "" : c.k);
                  }}
                  className={chip(on)}
                >
                  {t(c.zh, c.en)}
                  <span className={`text-[11px] ${on ? "text-white/80" : c.k === "OVERDUE" ? "font-semibold text-rose-600" : "text-gray-400"}`}>{n}</span>
                </button>
              );
            })}
            {typeKeys.length > 1 && (
              <>
                <span aria-hidden="true" className="my-1.5 w-px shrink-0 bg-gray-200" />
                {typeKeys
                  .filter((k) => k === typeFilter || (typeCounts.get(k) ?? 0) > 0)
                  .map((k) => {
                    const on = typeFilter === k;
                    return (
                      <button key={k} type="button" aria-pressed={on} onClick={() => setTypeFilter(on ? "" : k)} className={chip(on)}>
                        {typeName(k)}
                        <span className={`text-[11px] ${on ? "text-white/80" : "text-gray-400"}`}>{typeCounts.get(k) ?? 0}</span>
                      </button>
                    );
                  })}
              </>
            )}
          </div>
        </>
      )}

      {error && (
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <span>{error}</span>
          <button type="button" onClick={load} className="shrink-0 font-semibold underline">
            {t("再试一次", "Try again")}
          </button>
        </div>
      )}
      {!items && !error && (
        <ul className="space-y-2" aria-label={t("载入中", "Loading")}>
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="h-14 animate-pulse rounded-2xl bg-white/80 motion-reduce:animate-none" />
          ))}
        </ul>
      )}
      {items && items.length === 0 && (
        <div className="rounded-[20px] bg-white px-6 py-12 text-center shadow-sm">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-teal-50 text-teal-600">
            <IconCheck size={26} />
          </span>
          <p className="mt-3 font-medium text-gray-900">{t("没有未清账单", "No unpaid bills")}</p>
          <p className="mt-1 text-sm text-gray-500">{t("每一张账单都已经付清了。", "Every bill has been paid.")}</p>
        </div>
      )}

      {items && items.length > 0 && (
        <>
          {isFiltered && (
            <p className="px-1 text-xs text-gray-500">
              {t(`显示 ${filteredBills.length} 笔（共 ${items.length} 笔）`, `${filteredBills.length} of ${items.length} shown`)}
            </p>
          )}

          {selectedIds.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-amber-50 px-3 py-2 text-[13px] text-amber-800">
              <span className="font-semibold">{t(`已选 ${selectedIds.size} 笔`, `${selectedIds.size} selected`)}</span>
              <span className="flex-1" />
              {filteredBills.some((p) => !selectedIds.has(p.id)) && (
                <button
                  type="button"
                  onClick={() => setSelectedIds((prev) => new Set([...prev, ...filteredBills.map((p) => p.id)]))}
                  className="h-8 rounded-lg bg-white/70 px-2.5 text-xs font-semibold text-amber-900 hover:bg-white md:hidden"
                >
                  {t(`全选 ${filteredBills.length}`, `Select all ${filteredBills.length}`)}
                </button>
              )}
              <button type="button" onClick={() => setSelectedIds(new Set())} className="h-8 rounded-lg bg-white/70 px-2.5 text-xs font-semibold text-gray-600 hover:bg-white">
                {t("取消", "Clear")}
              </button>
              <button
                type="button"
                onClick={() => setBulkConfirmOpen(true)}
                className="flex h-8 items-center gap-1 rounded-lg bg-rose-600 px-2.5 text-xs font-semibold text-white hover:bg-rose-700"
              >
                <IconTrash size={14} />
                {t("删除", "Delete")}
              </button>
            </div>
          )}

          {filteredBills.length === 0 ? (
            <p className="rounded-[20px] bg-white px-4 py-8 text-center text-sm text-gray-400">{t("没有符合条件的账单", "No bills match")}</p>
          ) : (
            <>
              {/* Phones: two short lines per bill, like the contract and room cards — who and how
                  much, then where it's stuck, how late, what it's for and when it was due. */}
              <ul className="space-y-2 md:hidden">
                {filteredBills.map((p) => {
                  const badge = badgeOf(p);
                  const od = overdueDays(p, today);
                  const picked = selectedIds.has(p.id);
                  return (
                    <li
                      key={p.id}
                      className={`flex items-center gap-2.5 rounded-2xl bg-white py-2 pl-3 pr-1.5 shadow-[0_1px_2px_rgba(30,27,46,0.05)] ${picked ? "ring-2 ring-amber-300" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={picked}
                        onChange={() => toggleSelected(p.id)}
                        aria-label={t(`选择 ${p.roomCode} ${label(p)}`, `Select ${p.roomCode} ${label(p)}`)}
                        className="h-4 w-4 shrink-0 accent-brand"
                      />
                      <Link href={`/contracts/${p.contractCode}`} className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="flex min-w-0 items-baseline gap-1.5">
                            <b className="shrink-0 text-[15px] font-semibold text-gray-900">{p.roomCode}</b>
                            <span className="truncate text-[13px] text-gray-700">{p.tenantName}</span>
                          </p>
                          <b className={`shrink-0 whitespace-nowrap text-[14px] font-semibold tabular-nums ${od > 0 ? "text-rose-600" : "text-gray-900"}`}>{fmt(p.amountDue)}</b>
                        </div>
                        <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11.5px] text-gray-400">
                          <Pill tone={badge.tone}>{badge.label}</Pill>
                          <span className="truncate">
                            {od > 0 && <span className="font-medium text-rose-600">{t(`逾期 ${od} 天 · `, `${od}d overdue · `)}</span>}
                            <span className="font-medium text-gray-700">{label(p)}</span>
                            {p.periodMonth && <span className="text-gray-500"> {p.periodMonth}</span>}
                            {" · "}
                            {p.dueDate ? t(`到期 ${fmtDate(p.dueDate).slice(0, 5)}`, `due ${fmtDate(p.dueDate).slice(0, 5)}`) : t("没有到期日", "no due date")}
                          </span>
                        </p>
                      </Link>
                      <button
                        type="button"
                        onClick={() => setDeletingBill(p)}
                        aria-label={t(`删除 ${p.roomCode} ${label(p)}`, `Delete ${p.roomCode} ${label(p)}`)}
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-gray-400 hover:bg-rose-50 hover:text-rose-600"
                      >
                        <IconTrash size={16} />
                      </button>
                    </li>
                  );
                })}
              </ul>

              <div className="hidden overflow-x-auto rounded-[20px] bg-white p-4 shadow-sm md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left text-gray-600">
                      <th className="px-2.5 py-1.5 font-semibold">
                        <input
                          type="checkbox"
                          aria-label={t("全选", "Select all")}
                          checked={filteredBills.every((p) => selectedIds.has(p.id))}
                          onChange={(e) => {
                            setSelectedIds((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) filteredBills.forEach((p) => next.add(p.id));
                              else filteredBills.forEach((p) => next.delete(p.id));
                              return next;
                            });
                          }}
                        />
                      </th>
                      <th className="px-2.5 py-1.5 font-semibold">{t("合同", "Contract")}</th>
                      <th className="px-2.5 py-1.5 font-semibold">{t("项目", "Item")}</th>
                      <th className="px-2.5 py-1.5 font-semibold">{t("金额", "Amount")}</th>
                      <th className="px-2.5 py-1.5 font-semibold">{t("到期日", "Due Date")}</th>
                      <th className="px-2.5 py-1.5 font-semibold">{t("状态", "Status")}</th>
                      <th className="px-2.5 py-1.5 font-semibold">{t("提交日期", "Submitted")}</th>
                      <th className="px-2.5 py-1.5 font-semibold">{t("操作", "Actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBills.map((p) => {
                      const badge = badgeOf(p);
                      const od = overdueDays(p, today);
                      return (
                        <tr key={p.id} className="border-b border-gray-100">
                          <td className="px-2.5 py-1.5">
                            <input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleSelected(p.id)} />
                          </td>
                          <td className="px-2.5 py-1.5">
                            <Link href={`/contracts/${p.contractCode}`} className="text-brand hover:underline">
                              {p.contractCode}
                            </Link>
                            <div className="text-xs text-gray-500">
                              {p.roomCode} · {p.tenantName}
                            </div>
                          </td>
                          <td className="px-2.5 py-1.5">
                            {label(p)}
                            {p.periodMonth ? ` (${p.periodMonth})` : ""}
                          </td>
                          <td className={`px-2.5 py-1.5 font-semibold ${od > 0 ? "text-rose-600" : ""}`}>{fmt(p.amountDue)}</td>
                          <td className={`px-2.5 py-1.5 ${od > 0 ? "font-semibold text-rose-600" : ""}`}>
                            {fmtDate(p.dueDate)}
                            {od > 0 ? t(` · 逾期 ${od} 天`, ` · ${od}d overdue`) : ""}
                          </td>
                          <td className="px-2.5 py-1.5">
                            <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${PILL[badge.tone]}`}>{badge.label}</span>
                          </td>
                          <td className="px-2.5 py-1.5 text-gray-600">{fmtDate(p.submittedDate)}</td>
                          <td className="px-2.5 py-1.5">
                            <button
                              onClick={() => setDeletingBill(p)}
                              className="rounded-md bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-200"
                            >
                              🗑️ {t("删除", "Delete")}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      <ConfirmDialog
        open={!!deletingBill}
        danger
        title={`⚠️ ${t("删除账单", "Delete Bill")}`}
        message={t(
          `确定要删除 ${deletingBill?.contractCode} 的这笔 ${deletingBill ? paymentTypeLabelLocale(deletingBill.type, deletingBill.customLabel, locale) : ""} (${deletingBill ? fmt(deletingBill.amountDue) : ""}) 账单吗？${
            deletingBill?.status === "PENDING_REVIEW"
              ? "租客已经上传的交易单也会一起消失，无法恢复。"
              : "此操作不能撤销。"
          }`,
          `Are you sure you want to delete ${deletingBill?.contractCode}'s ${deletingBill ? paymentTypeLabelLocale(deletingBill.type, deletingBill.customLabel, locale) : ""} (${deletingBill ? fmt(deletingBill.amountDue) : ""}) bill? ${
            deletingBill?.status === "PENDING_REVIEW"
              ? "The tenant's already-uploaded transaction slip will be discarded too, with no way to recover it."
              : "This action cannot be undone."
          }`
        )}
        confirmLabel={t("确定删除", "Confirm Delete")}
        onConfirm={() => deletingBill && deleteBill(deletingBill.id)}
        onCancel={() => setDeletingBill(null)}
      />

      <ConfirmDialog
        open={bulkConfirmOpen}
        danger
        title={`⚠️ ${t("删除已选账单", "Delete Selected Bills")}`}
        message={t(
          `确定要删除这 ${selectedIds.size} 笔账单吗？${
            selectedPendingReviewCount > 0
              ? `其中 ${selectedPendingReviewCount} 笔已经有租客上传的交易单，会一起消失，无法恢复。`
              : "此操作不能撤销。"
          }`,
          `Are you sure you want to delete these ${selectedIds.size} bills? ${
            selectedPendingReviewCount > 0
              ? `${selectedPendingReviewCount} of them already have a tenant-uploaded slip, which will be discarded too, with no way to recover it.`
              : "This action cannot be undone."
          }`
        )}
        confirmLabel={bulkDeleting ? t("删除中...", "Deleting...") : t("确定删除", "Confirm Delete")}
        onConfirm={bulkDelete}
        onCancel={() => setBulkConfirmOpen(false)}
      />
    </div>
  );
}
