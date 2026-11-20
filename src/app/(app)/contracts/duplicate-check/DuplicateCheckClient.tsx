"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { paymentTypeLabelLocale } from "@/lib/config";
import { fmtMoney, fmtDate } from "@/lib/format";
import { useLanguage } from "@/components/LanguageProvider";

interface Row {
  paymentCode: string;
  amountDue: number;
  amountPaid: number;
  status: string;
  dueDate: string | null;
  paidDate: string | null;
  notes: string | null;
}
interface DuplicateGroup {
  contractCode: string;
  tenantName: string;
  type: string;
  periodMonth: string | null;
  totalAmountDue: number;
  rows: Row[];
}

export default function DuplicateCheckClient() {
  const { locale, t } = useLanguage();
  const [duplicates, setDuplicates] = useState<DuplicateGroup[] | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/contracts/duplicate-bills-check");
      const data = await res.json();
      if (!data.success) {
        setError(data.message);
        return;
      }
      setDuplicates(data.duplicates);
    } catch {
      setError(t("出错，请稍后再试", "Something went wrong — please try again later"));
    }
  }, [t]);

  useEffect(() => {
    // setState happens after the fetch's await, not synchronously in the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="rounded-xl bg-white p-5 shadow-sm">
        <div className="mb-3.5 flex items-center justify-between">
          <h3 className="text-base font-semibold text-brand">🔍 {t("重复账单检查", "Duplicate Bill Check")}</h3>
          <Link href="/contracts" className="text-sm text-gray-500 hover:underline">
            ← {t("返回合同清单", "Back to Contracts")}
          </Link>
        </div>
        <div className="mb-3.5 rounded-lg bg-brand-light/40 p-3.5 text-sm text-gray-600">
          {t(
            "找出同一份合同、同一个项目 (同一个月份，或一次性项目如押金/Admin Fee) 却有超过一笔账单的情况 — 这种重复会让「应收」看起来比实际高。点进合同的「收款」查看，确认哪一笔是多出来的，用收款历史的删除按钮清掉。这里只是检查，不会自动改动任何资料。",
            "Finds cases where the same contract has more than one bill for the same thing (same month, or a one-time item like Deposit/Admin Fee) — this kind of duplicate makes \"应收\" (amount due) look higher than it really is. Open the contract's 收款 to see which one is the extra one, and remove it with the Payment History delete button. This page is read-only — it never changes anything itself."
          )}
        </div>

        {error && <div className="text-sm text-red-600">{error}</div>}
        {!duplicates && !error && <div className="text-sm text-gray-500">{t("检查中...", "Checking...")}</div>}
        {duplicates && duplicates.length === 0 && (
          <div className="py-8 text-center text-sm text-gray-400">✅ {t("没有发现重复账单", "No duplicate bills found")}</div>
        )}

        {duplicates && duplicates.length > 0 && (
          <div className="space-y-3">
            {duplicates.map((g, i) => (
              <div key={i} className="rounded-lg border border-red-200 bg-red-50/40 p-3.5">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm">
                    <Link href={`/contracts/${g.contractCode}`} className="font-semibold text-brand hover:underline">
                      {g.contractCode}
                    </Link>{" "}
                    · {g.tenantName} ·{" "}
                    <span className="font-semibold">{paymentTypeLabelLocale(g.type, null, locale)}</span>
                    {g.periodMonth ? ` (${g.periodMonth})` : ` (${t("一次性项目", "one-time item")})`}
                  </div>
                  <div className="text-sm font-semibold text-red-600">
                    {g.rows.length} {t("笔, 合计算入应收", "bills, total counted toward 应收")} {fmtMoney(g.totalAmountDue)}
                  </div>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-gray-500">
                      <th className="py-1 pr-2">{t("账单号", "Bill #")}</th>
                      <th className="py-1 pr-2">{t("应收", "Due")}</th>
                      <th className="py-1 pr-2">{t("已收", "Paid")}</th>
                      <th className="py-1 pr-2">{t("状态", "Status")}</th>
                      <th className="py-1 pr-2">{t("到期日", "Due Date")}</th>
                      <th className="py-1 pr-2">{t("付款日", "Paid Date")}</th>
                      <th className="py-1">{t("备注", "Notes")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.rows.map((r) => (
                      <tr key={r.paymentCode} className="border-t border-red-100">
                        <td className="py-1 pr-2">{r.paymentCode}</td>
                        <td className="py-1 pr-2">{fmtMoney(r.amountDue)}</td>
                        <td className="py-1 pr-2">{fmtMoney(r.amountPaid)}</td>
                        <td className="py-1 pr-2">{r.status}</td>
                        <td className="py-1 pr-2">{fmtDate(r.dueDate)}</td>
                        <td className="py-1 pr-2">{fmtDate(r.paidDate)}</td>
                        <td className="py-1">{r.notes || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
