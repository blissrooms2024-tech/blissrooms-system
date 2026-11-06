"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { PAYMENT_TYPE_LABELS, paymentTypeLabelLocale } from "@/lib/config";
import { fmtDate, fmtMoney as fmt } from "@/lib/format";
import { useLanguage } from "@/components/LanguageProvider";
import { useToast } from "@/components/Toast";
import ConfirmDialog from "@/components/ConfirmDialog";

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

const STATUS_BADGE: Record<string, { zh: string; en: string; cls: string }> = {
  PENDING: { zh: "等租客上传", en: "Awaiting Upload", cls: "bg-gray-100 text-gray-600" },
  PENDING_REVIEW: { zh: "待审核", en: "Pending Review", cls: "bg-yellow-50 text-yellow-800" },
  REJECTED: { zh: "已拒绝, 待重传", en: "Rejected, Re-upload Needed", cls: "bg-red-50 text-red-700" },
};


export default function OutstandingBillsClient() {
  const { locale, t } = useLanguage();
  const toast = useToast();
  const [items, setItems] = useState<Bill[] | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
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

  if (error) return <div className="rounded-xl bg-white p-5 text-sm text-red-600 shadow-sm">{error}</div>;
  if (!items) return <div className="rounded-xl bg-white p-5 text-sm text-gray-500 shadow-sm">{t("载入中...", "Loading...")}</div>;

  // Every possible bill type, not just the ones with an outstanding bill right now — otherwise
  // Admin can't even select "房租" to confirm there's nothing pending for it.
  const typeOptions = Object.keys(PAYMENT_TYPE_LABELS);
  const today = new Date().toISOString().slice(0, 10);
  const q = search.trim().toLowerCase();
  const selectedPendingReviewCount = items.filter(
    (p) => selectedIds.has(p.id) && p.status === "PENDING_REVIEW"
  ).length;
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
      <h3 className="mb-3.5 text-base font-semibold text-brand">
        {t("📋 未清账单 (全部未付)", "📋 Outstanding Bills (All Unpaid)")}
      </h3>
      <p className="mb-3.5 text-xs text-gray-500">
        {t(
          "所有还没变成「已付」的账单 — 包括还在等租客上传交易单的，方便跟进催缴，不用一间一间合同去检查。",
          "Every bill that hasn't turned \"Paid\" yet — including ones still awaiting the tenant's slip upload — so you can follow up without checking each contract one by one."
        )}
      </p>

      {items.length === 0 ? (
        <div className="py-8 text-center text-gray-400">{t("🎉 没有未清账单", "🎉 No outstanding bills")}</div>
      ) : (
        <>
          <div className="mb-3.5 flex flex-wrap gap-2.5">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("搜索合同号 / 房间 / 租客姓名", "Search contract code / room / tenant name")}
              className="input max-w-[220px] flex-1"
            />
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="input max-w-[160px]">
              <option value="">{t("全部项目", "All Items")}</option>
              {typeOptions.map((ty) => (
                <option key={ty} value={ty}>
                  {paymentTypeLabelLocale(ty, undefined, locale)}
                </option>
              ))}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input max-w-[160px]">
              <option value="">{t("全部状态", "All Statuses")}</option>
              <option value="PENDING">{t("等租客上传", "Awaiting Upload")}</option>
              <option value="PENDING_REVIEW">{t("待审核", "Pending Review")}</option>
              <option value="REJECTED">{t("已拒绝, 待重传", "Rejected, Re-upload Needed")}</option>
            </select>
          </div>

          {selectedIds.size > 0 && (
            <div className="mb-3.5 flex items-center gap-2.5 rounded-lg bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
              <span className="font-semibold">
                {t(`已选 ${selectedIds.size} 笔`, `${selectedIds.size} selected`)}
              </span>
              <button
                onClick={() => setBulkConfirmOpen(true)}
                className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-700"
              >
                🗑️ {t("删除已选", "Delete Selected")}
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="rounded-md bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-200"
              >
                {t("取消选择", "Clear Selection")}
              </button>
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="py-8 text-center text-gray-400">{t("没有符合条件的账单", "No bills match your filters")}</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-gray-600">
                  <th className="px-2.5 py-1.5 font-semibold">
                    <input
                      type="checkbox"
                      checked={filtered.length > 0 && filtered.every((p) => selectedIds.has(p.id))}
                      onChange={(e) => {
                        setSelectedIds((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) filtered.forEach((p) => next.add(p.id));
                          else filtered.forEach((p) => next.delete(p.id));
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
                {filtered.map((p) => {
                  const badgeDef = STATUS_BADGE[p.status];
                  const badge = badgeDef
                    ? { label: t(badgeDef.zh, badgeDef.en), cls: badgeDef.cls }
                    : { label: p.status, cls: "bg-gray-100 text-gray-600" };
                  const overdue = p.status === "PENDING" && p.dueDate && p.dueDate.slice(0, 10) < today;
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
                        {paymentTypeLabelLocale(p.type, p.customLabel, locale)}
                        {p.periodMonth ? ` (${p.periodMonth})` : ""}
                      </td>
                      <td className="px-2.5 py-1.5 font-semibold">{fmt(p.amountDue)}</td>
                      <td className={`px-2.5 py-1.5 ${overdue ? "font-semibold text-red-600" : ""}`}>
                        {fmtDate(p.dueDate)}
                        {overdue ? ` ⚠️${t("逾期", "Overdue")}` : ""}
                      </td>
                      <td className="px-2.5 py-1.5">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge.cls}`}>
                          {badge.label}
                        </span>
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
