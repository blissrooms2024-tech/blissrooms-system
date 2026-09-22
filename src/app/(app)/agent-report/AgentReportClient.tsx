"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { COMPANY, CONTRACT_IMAGES, contractStatusLabel } from "@/lib/config";
import { fmtMoney, fmtDate } from "@/lib/format";
import { useToast } from "@/components/Toast";
import { useLanguage } from "@/components/LanguageProvider";
import { REPORT_DOC_STYLE } from "@/lib/reportDocStyle";

type Period = "month" | "year" | "all";

interface ContractRow {
  contractCode: string;
  roomCode: string;
  tenantName: string;
  status: string;
  createdAt: string;
  commencementDate: string | null;
  expiredDate: string | null;
  roomRental: number;
  carparkRental: number;
  depositOutstanding: number;
}
interface Report {
  period: Period;
  month: string;
  year: number;
  stats: { newContracts: number; activeRooms: number; totalRent: number };
  contracts: ContractRow[];
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export default function AgentReportClient() {
  const toast = useToast();
  const { locale, t } = useLanguage();
  const PERIOD_LABELS: Record<Period, string> = {
    month: t("本月", "This Month"),
    year: t("本年", "This Year"),
    all: t("累计", "Cumulative"),
  };
  const searchParams = useSearchParams();
  const initialPeriod = (searchParams.get("period") as Period) || "all";

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
      const res = await fetch(`/api/contracts/agent-report?${qs}`);
      const data = await res.json();
      if (!data.success) {
        setError(data.message);
        return;
      }
      setReport(data);
    } catch {
      setError(t("出错，请稍后再试", "Something went wrong, please try again later"));
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
      toast.warning(t("浏览器拦截了弹出式窗口，请允许弹窗后再试一次", "Your browser blocked the pop-up window — please allow pop-ups and try again"));
      return;
    }
    w.document.write(
      `<html><head><title>${t("我的合同报告", "My Contract Report")} - Bliss Rooms</title><meta charset="utf-8">` +
        `<style>body{margin:0;padding:34px;max-width:820px;margin:auto;}@media print{@page{margin:14mm;}}</style>` +
        `</head><body>${html}</body></html>`
    );
    w.document.close();
    setTimeout(() => w.print(), 400);
  }

  const years = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i);

  return (
    <div className="rounded-xl bg-white p-5 shadow-sm">
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2.5 no-print">
        <h3 className="text-base font-semibold text-brand">📊 {t("我的合同报告", "My Contract Report")}</h3>
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
                {PERIOD_LABELS[p]}
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
              🖨️ {t("打印 / 存 PDF", "Print / Save PDF")}
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
                <div className="sub">{t("我的合同报告", "My Contract Report")}</div>
              </div>
            </div>
            <div className="titleBlock">
              <div className="title">AGENT REPORT</div>
              <div className="titleMeta">
                {period === "month" && `${t("报告月份", "Report Month")}: ${report.month}`}
                {period === "year" && `${t("报告年份", "Report Year")}: ${report.year}`}
                {period === "all" && t("累计 (至今)", "Cumulative (to date)")}
              </div>
            </div>
          </div>

          <div className="statRow">
            <div className="stat">
              <div className="n">{report.stats.newContracts}</div>
              <div className="l">{period === "all" ? t("总成交合同", "Total Contracts") : t("新增合同", "New Contracts")}</div>
            </div>
            <div className="stat">
              <div className="n">{report.stats.activeRooms}</div>
              <div className="l">{t("出租中房间", "Occupied Rooms")}</div>
            </div>
            <div className="stat alt">
              <div className="n">{fmtMoney(report.stats.totalRent)}</div>
              <div className="l">{t("出租中总租金/月", "Total Rent (Occupied) / Month")}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>{t("合同", "Contract")}</th>
                <th>{t("租客", "Tenant")}</th>
                <th>{t("状态", "Status")}</th>
                <th>{t("开始~到期", "Start ~ Expiry")}</th>
                <th className="num">{t("租金", "Rent")}</th>
                <th className="num">{t("押金", "Deposit")}</th>
              </tr>
            </thead>
            <tbody>
              {report.contracts.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty">
                    {t("这段时间没有合同记录", "No contract records for this period")}
                  </td>
                </tr>
              )}
              {report.contracts.map((c) => (
                <tr key={c.contractCode}>
                  <td>
                    <Link href={`/contracts/${c.contractCode}`}>
                      <b>{c.contractCode}</b>
                    </Link>{" "}
                    · {c.roomCode}
                  </td>
                  <td>{c.tenantName}</td>
                  <td>{contractStatusLabel(c.status, locale)}</td>
                  <td>
                    {fmtDate(c.commencementDate)} ~ {fmtDate(c.expiredDate)}
                  </td>
                  <td className="num">{fmtMoney(c.roomRental + c.carparkRental)}</td>
                  <td className="num">
                    {c.depositOutstanding > 0 ? (
                      <span style={{ color: "#dc2626", fontWeight: 700 }}>{t("欠", "Owes")} {fmtMoney(c.depositOutstanding)}</span>
                    ) : (
                      <span style={{ color: "#15803d" }}>✅ {t("收齐", "Fully Collected")}</span>
                    )}
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
