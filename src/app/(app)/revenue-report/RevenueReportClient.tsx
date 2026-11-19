"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { COMPANY, CONTRACT_IMAGES, PAYMENT_TYPE_LABELS, paymentTypeLabelLocale, isDepositLiabilityType } from "@/lib/config";
import { fmtMoney } from "@/lib/format";
import { useToast } from "@/components/Toast";
import { REPORT_DOC_STYLE } from "@/lib/reportDocStyle";
import { useLanguage } from "@/components/LanguageProvider";

type Period = "month" | "year" | "all";

interface Report {
  period: Period;
  month: string;
  year: number;
  total: number;
  revenueTotal: number;
  depositLiabilityTotal: number;
  byType: Record<string, number>;
  byProperty: { name: string; amount: number }[];
  transactionCount: number;
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export default function RevenueReportClient() {
  const toast = useToast();
  const { locale, t } = useLanguage();
  const periodLabels: Record<Period, string> = {
    month: t("本月", "This Month"),
    year: t("本年", "This Year"),
    all: t("累计", "All Time"),
  };
  const searchParams = useSearchParams();
  const initialPeriod = (searchParams.get("period") as Period) || "month";

  const [period, setPeriod] = useState<Period>(initialPeriod);
  const [month, setMonth] = useState(currentMonth());
  const [year, setYear] = useState(new Date().getFullYear());
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const printAreaRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const qs = new URLSearchParams({ period });
      if (period === "month") qs.set("month", month);
      if (period === "year") qs.set("year", String(year));
      const res = await fetch(`/api/revenue-report?${qs}`);
      const data = await res.json();
      if (!data.success) {
        setError(data.message);
        return;
      }
      setReport(data);
    } catch {
      setError(t("出错，请稍后再试", "An error occurred, please try again later"));
    }
  }, [period, month, year, t]);

  useEffect(() => {
    // setState happens after the fetch's await, not synchronously in the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  function printReport() {
    if (!printAreaRef.current) return;
    const html = printAreaRef.current.innerHTML;
    const w = window.open("", "_blank");
    if (!w) {
      toast.warning(t("浏览器拦截了弹出式窗口，请允许弹窗后再试一次", "The browser blocked the pop-up window. Please allow pop-ups and try again."));
      return;
    }
    w.document.write(
      `<html><head><title>${t("营业额报告", "Revenue Report")} - Bliss Rooms</title><meta charset="utf-8">` +
        `<style>body{margin:0;padding:34px;max-width:820px;margin:auto;}@media print{@page{margin:14mm;}}</style>` +
        `</head><body>${html}</body></html>`
    );
    w.document.close();
    setTimeout(() => w.print(), 400);
  }

  const typeKeys = report ? Object.keys(PAYMENT_TYPE_LABELS).filter((k) => report.byType[k]) : [];
  const revenueKeys = typeKeys.filter((k) => !isDepositLiabilityType(k));
  const liabilityKeys = typeKeys.filter((k) => isDepositLiabilityType(k));
  const years = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i);

  return (
    <div className="rounded-xl bg-white p-5 shadow-sm">
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2.5 no-print">
        <h3 className="text-base font-semibold text-brand">{t("📊 营业额报告", "📊 Revenue Report")}</h3>
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
          {report && (
            <button onClick={printReport} className="rounded-lg bg-green-700 px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-green-800">
              {t("🖨️ 打印 / 存 PDF", "🖨️ Print / Save PDF")}
            </button>
          )}
        </div>
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}
      {!report && !error && <div className="text-sm text-gray-500">{t("载入中...", "Loading...")}</div>}

      {report && (
        <div ref={printAreaRef}>
        <div className="reportDoc">
          <style>{REPORT_DOC_STYLE}</style>

          <div className="hd">
            <div className="brand">
              {CONTRACT_IMAGES.logo && <img src={CONTRACT_IMAGES.logo} alt="logo" />}
              <div>
                <div className="nm">{COMPANY.NAME}</div>
                <div className="sub">
                  {report.transactionCount} {t("笔已收款项", "payments received")}
                </div>
              </div>
            </div>
            <div className="titleBlock">
              <div className="title">REVENUE REPORT</div>
              <div className="titleMeta">
                {period === "month" && `${t("报告月份", "Report Month")}: ${report.month}`}
                {period === "year" && `${t("报告年份", "Report Year")}: ${report.year}`}
                {period === "all" && t("累计总额 (至今)", "Cumulative Total (To Date)")}
              </div>
            </div>
          </div>

          <div className="statRow">
            <div className="stat">
              <div className="n">{fmtMoney(report.total)}</div>
              <div className="l">
                {periodLabels[report.period]}
                {t("总收款 (现金/银行)", " Total Collected (Cash/Bank)")}
              </div>
            </div>
            <div className="stat">
              <div className="n">{fmtMoney(report.revenueTotal)}</div>
              <div className="l">{t("营业收入 (损益表)", "Revenue (Income Statement)")}</div>
            </div>
            <div className="stat alt">
              <div className="n">{fmtMoney(report.depositLiabilityTotal)}</div>
              <div className="l">{t("代收押金 (负债, 资产负债表)", "Deposits Held (Liability, Balance Sheet)")}</div>
            </div>
          </div>

          <h4>{t("📒 借贷分类汇总 (Debit & Credit Summary)", "📒 Debit & Credit Summary")}</h4>
          <table>
            <thead>
              <tr>
                <th>{t("科目 Account", "Account")}</th>
                <th className="num">{t("借方 Debit (RM)", "Debit (RM)")}</th>
                <th className="num">{t("贷方 Credit (RM)", "Credit (RM)")}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <b>{t("现金 / 银行 Cash / Bank", "Cash / Bank")}</b>
                </td>
                <td className="num">
                  <b>{fmtMoney(report.total)}</b>
                </td>
                <td className="num"></td>
              </tr>
              {revenueKeys.length > 0 && (
                <tr>
                  <td colSpan={3} style={{ paddingTop: "8px", fontWeight: 600, color: "#555" }}>
                    {t("营业收入 Revenue", "Revenue")}
                  </td>
                </tr>
              )}
              {revenueKeys.map((k) => (
                <tr key={k}>
                  <td style={{ paddingLeft: "16px" }}>{paymentTypeLabelLocale(k, null, locale)} Income</td>
                  <td className="num"></td>
                  <td className="num">{fmtMoney(report.byType[k])}</td>
                </tr>
              ))}
              {liabilityKeys.length > 0 && (
                <tr>
                  <td colSpan={3} style={{ paddingTop: "8px", fontWeight: 600, color: "#555" }}>
                    {t("代收押金 (负债) Deposits Payable (Liability)", "Deposits Payable (Liability)")}
                  </td>
                </tr>
              )}
              {liabilityKeys.map((k) => (
                <tr key={k}>
                  <td style={{ paddingLeft: "16px" }}>{paymentTypeLabelLocale(k, null, locale)} Payable</td>
                  <td className="num"></td>
                  <td className="num">{fmtMoney(report.byType[k])}</td>
                </tr>
              ))}
              {typeKeys.length === 0 && (
                <tr>
                  <td colSpan={3} className="empty">
                    {t("这段时间没有收款记录", "No income records for this period")}
                  </td>
                </tr>
              )}
              <tr>
                <td>
                  <b>{t("合计 TOTAL", "TOTAL")}</b>
                </td>
                <td className="num">
                  <b>{fmtMoney(report.total)}</b>
                </td>
                <td className="num">
                  <b>{fmtMoney(report.total)}</b>
                </td>
              </tr>
            </tbody>
          </table>

          <h4>{t("🧾 营业收入明细 (损益表)", "🧾 Revenue Breakdown (Income Statement)")}</h4>
          <table>
            <thead>
              <tr>
                <th>{t("项目", "Category")}</th>
                <th className="num">{t("金额", "Amount")}</th>
              </tr>
            </thead>
            <tbody>
              {revenueKeys.length === 0 && (
                <tr>
                  <td colSpan={2} className="empty">
                    {t("这段时间没有营业收入记录", "No revenue records for this period")}
                  </td>
                </tr>
              )}
              {revenueKeys.map((k) => (
                <tr key={k}>
                  <td>{paymentTypeLabelLocale(k, null, locale)}</td>
                  <td className="num">
                    <b>{fmtMoney(report.byType[k])}</b>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <h4>{t("🔒 代收押金明细 (负债, 资产负债表)", "🔒 Deposits Payable (Liability, Balance Sheet)")}</h4>
          <table>
            <thead>
              <tr>
                <th>{t("项目", "Category")}</th>
                <th className="num">{t("金额", "Amount")}</th>
              </tr>
            </thead>
            <tbody>
              {liabilityKeys.length === 0 && (
                <tr>
                  <td colSpan={2} className="empty">
                    {t("这段时间没有代收押金记录", "No deposit records for this period")}
                  </td>
                </tr>
              )}
              {liabilityKeys.map((k) => (
                <tr key={k}>
                  <td>{paymentTypeLabelLocale(k, null, locale)}</td>
                  <td className="num">
                    <b>{fmtMoney(report.byType[k])}</b>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <h4>{t("🏢 按楼盘分类", "🏢 By Property")}</h4>
          <table>
            <thead>
              <tr>
                <th>{t("楼盘", "Property")}</th>
                <th className="num">{t("金额", "Amount")}</th>
              </tr>
            </thead>
            <tbody>
              {report.byProperty.length === 0 && (
                <tr>
                  <td colSpan={2} className="empty">
                    {t("这段时间没有收款记录", "No income records for this period")}
                  </td>
                </tr>
              )}
              {report.byProperty.map((p) => (
                <tr key={p.name}>
                  <td>{p.name}</td>
                  <td className="num">
                    <b>{fmtMoney(p.amount)}</b>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>
      )}
    </div>
  );
}
