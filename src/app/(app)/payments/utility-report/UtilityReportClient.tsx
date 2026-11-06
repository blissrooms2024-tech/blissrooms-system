"use client";

import { useEffect, useState, useCallback } from "react";
import { paymentTypeLabelLocale } from "@/lib/config";
import { fmtMoney, fmtDate } from "@/lib/format";
import { useLanguage } from "@/components/LanguageProvider";

type Period = "month" | "year" | "all";
type UtilityType = "AC" | "DRYER" | "ELECTRIC" | "OTHER";

interface Row {
  paymentCode: string;
  contractCode: string;
  roomCode: string;
  tenantName: string | null;
  type: string;
  customLabel: string | null;
  amountPaid: number;
  paidDate: string | null;
}

interface Report {
  period: Period;
  month: string;
  year: number;
  rows: Row[];
  totalsByType: Record<string, number>;
  grandTotal: number;
}

const UTILITY_TYPES: UtilityType[] = ["AC", "DRYER", "ELECTRIC", "OTHER"];

interface PropertyOption {
  propertyCode: string;
  name: string;
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

/** Per-room/tenant detail behind Revenue Report's company-wide AC/Dryer/Electric/Other
 * totals — Admin wants to see exactly which room/tenant paid what, not just one rolled-up
 * number per category. */
export default function UtilityReportClient() {
  const { locale, t } = useLanguage();
  const periodLabels: Record<Period, string> = {
    month: t("本月", "This Month"),
    year: t("本年", "This Year"),
    all: t("累计", "All Time"),
  };
  const [period, setPeriod] = useState<Period>("month");
  const [month, setMonth] = useState(currentMonth());
  const [year, setYear] = useState(new Date().getFullYear());
  const [typeFilter, setTypeFilter] = useState<UtilityType | "">("");
  const [unitFilter, setUnitFilter] = useState("");
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/properties")
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setProperties(data.properties);
      })
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setError("");
    try {
      const qs = new URLSearchParams({ period });
      if (period === "month") qs.set("month", month);
      if (period === "year") qs.set("year", String(year));
      if (typeFilter) qs.set("type", typeFilter);
      if (unitFilter) qs.set("unit", unitFilter);
      const res = await fetch(`/api/payments/utility-report?${qs}`);
      const data = await res.json();
      if (!data.success) {
        setError(data.message);
        return;
      }
      setReport(data);
    } catch {
      setError(t("出错，请稍后再试", "An error occurred, please try again later"));
    }
  }, [period, month, year, typeFilter, unitFilter, t]);

  useEffect(() => {
    // setState happens after the fetch's await, not synchronously in the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const years = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i);

  return (
    <div className="rounded-xl bg-white p-5 shadow-sm">
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2.5">
        <h3 className="text-base font-semibold text-brand">
          {t("❄️ 冷气 / 烘干机 / 电费 / 其他 报表", "❄️ AC / Dryer / Electric / Other Report")}
        </h3>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex gap-1.5">
            {(["month", "year", "all"] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  period === p ? "bg-brand text-white" : "bg-gray-100 text-gray-600"
                }`}
              >
                {periodLabels[p]}
              </button>
            ))}
          </div>
          {period === "month" && (
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
            />
          )}
          {period === "year" && (
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          )}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as UtilityType | "")}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
          >
            <option value="">{t("全部项目", "All Items")}</option>
            {UTILITY_TYPES.map((ty) => (
              <option key={ty} value={ty}>
                {paymentTypeLabelLocale(ty, undefined, locale)}
              </option>
            ))}
          </select>
          <select
            value={unitFilter}
            onChange={(e) => setUnitFilter(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
          >
            <option value="">{t("全部楼盘", "All Units")}</option>
            {properties.map((p) => (
              <option key={p.propertyCode} value={p.propertyCode}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}
      {!report && !error && <div className="text-sm text-gray-500">{t("载入中...", "Loading...")}</div>}

      {report && (
        <>
          <div className="mb-3.5 flex flex-wrap gap-2.5">
            {UTILITY_TYPES.map((ty) => (
              <div key={ty} className="min-w-[130px] flex-1 rounded-lg bg-gray-50 p-3 text-center">
                <div className="text-lg font-bold text-brand">{fmtMoney(report.totalsByType[ty] ?? 0)}</div>
                <div className="text-xs text-gray-500">{paymentTypeLabelLocale(ty, undefined, locale)}</div>
              </div>
            ))}
            <div className="min-w-[130px] flex-1 rounded-lg bg-brand-light p-3 text-center">
              <div className="text-lg font-bold text-brand">{fmtMoney(report.grandTotal)}</div>
              <div className="text-xs text-gray-500">{t("总计", "Total")}</div>
            </div>
          </div>

          {report.rows.length === 0 ? (
            <div className="py-8 text-center text-gray-400">{t("这段时间没有收款记录", "No payment records for this period")}</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-gray-600">
                  <th className="px-2.5 py-1.5 font-semibold">{t("合同", "Contract")}</th>
                  <th className="px-2.5 py-1.5 font-semibold">{t("项目", "Item")}</th>
                  <th className="px-2.5 py-1.5 font-semibold">{t("金额", "Amount")}</th>
                  <th className="px-2.5 py-1.5 font-semibold">{t("付款日期", "Paid Date")}</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((r) => (
                  <tr key={r.paymentCode} className="border-b border-gray-100">
                    <td className="px-2.5 py-1.5">
                      <span className="text-brand">{r.contractCode}</span>
                      <div className="text-xs text-gray-500">
                        {r.roomCode} · {r.tenantName}
                      </div>
                    </td>
                    <td className="px-2.5 py-1.5">{paymentTypeLabelLocale(r.type, r.customLabel, locale)}</td>
                    <td className="px-2.5 py-1.5 font-semibold">{fmtMoney(r.amountPaid)}</td>
                    <td className="px-2.5 py-1.5">{fmtDate(r.paidDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
