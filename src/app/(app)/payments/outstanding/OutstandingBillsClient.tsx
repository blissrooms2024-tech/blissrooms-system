"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { PAYMENT_TYPE_LABELS, paymentTypeLabelLocale } from "@/lib/config";
import { fmtDate } from "@/lib/format";
import { useLanguage } from "@/components/LanguageProvider";

interface Bill {
  id: string;
  paymentCode: string;
  contractCode: string;
  agentName: string;
  roomCode: string;
  tenantName: string | null;
  type: string;
  status: string;
  amountDue: number;
  amountPaid: number;
  periodMonth: string | null;
  dueDate: string | null;
  reviewNote: string | null;
  customLabel: string | null;
}

const STATUS_BADGE: Record<string, { zh: string; en: string; cls: string }> = {
  PENDING: { zh: "等租客上传", en: "Awaiting Upload", cls: "bg-gray-100 text-gray-600" },
  PENDING_REVIEW: { zh: "待审核", en: "Pending Review", cls: "bg-yellow-50 text-yellow-800" },
  REJECTED: { zh: "已拒绝, 待重传", en: "Rejected, Re-upload Needed", cls: "bg-red-50 text-red-700" },
};

function fmt(v: number) {
  return v || v === 0 ? `RM${Number(v).toLocaleString()}` : "-";
}

export default function OutstandingBillsClient() {
  const { locale, t } = useLanguage();
  const [items, setItems] = useState<Bill[] | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

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

  if (error) return <div className="rounded-xl bg-white p-5 text-sm text-red-600 shadow-sm">{error}</div>;
  if (!items) return <div className="rounded-xl bg-white p-5 text-sm text-gray-500 shadow-sm">{t("载入中...", "Loading...")}</div>;

  // Every possible bill type, not just the ones with an outstanding bill right now — otherwise
  // Admin can't even select "房租" to confirm there's nothing pending for it.
  const typeOptions = Object.keys(PAYMENT_TYPE_LABELS);
  const today = new Date().toISOString().slice(0, 10);
  const q = search.trim().toLowerCase();
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

          {filtered.length === 0 ? (
            <div className="py-8 text-center text-gray-400">{t("没有符合条件的账单", "No bills match your filters")}</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-gray-600">
                  <th className="px-2.5 py-1.5 font-semibold">{t("合同", "Contract")}</th>
                  <th className="px-2.5 py-1.5 font-semibold">{t("项目", "Item")}</th>
                  <th className="px-2.5 py-1.5 font-semibold">{t("金额", "Amount")}</th>
                  <th className="px-2.5 py-1.5 font-semibold">{t("到期日", "Due Date")}</th>
                  <th className="px-2.5 py-1.5 font-semibold">{t("状态", "Status")}</th>
                  <th className="px-2.5 py-1.5 font-semibold">Agent</th>
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
                      <td className="px-2.5 py-1.5 text-gray-600">{p.agentName}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
