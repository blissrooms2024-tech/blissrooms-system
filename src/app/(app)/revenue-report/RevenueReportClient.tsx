"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { COMPANY, CONTRACT_IMAGES, PAYMENT_TYPE_LABELS } from "@/lib/config";
import { fmtMoney } from "@/lib/format";
import { useToast } from "@/components/Toast";
import { REPORT_DOC_STYLE } from "@/lib/reportDocStyle";

type Period = "month" | "year" | "all";

interface Report {
  period: Period;
  month: string;
  year: number;
  total: number;
  byType: Record<string, number>;
  byProperty: { name: string; amount: number }[];
  transactionCount: number;
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

const PERIOD_LABELS: Record<Period, string> = { month: "本月", year: "本年", all: "累计" };

export default function RevenueReportClient() {
  const toast = useToast();
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
      setError("出错，请稍后再试");
    }
  }, [period, month, year]);

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
      toast.warning("浏览器拦截了弹出式窗口，请允许弹窗后再试一次");
      return;
    }
    w.document.write(
      `<html><head><title>营业额报告 - Bliss Rooms</title><meta charset="utf-8">` +
        `<style>body{margin:0;padding:34px;max-width:820px;margin:auto;}@media print{@page{margin:14mm;}}</style>` +
        `</head><body>${html}</body></html>`
    );
    w.document.close();
    setTimeout(() => w.print(), 400);
  }

  const typeKeys = report ? Object.keys(PAYMENT_TYPE_LABELS).filter((k) => report.byType[k]) : [];
  const years = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i);

  return (
    <div className="rounded-xl bg-white p-5 shadow-sm">
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2.5 no-print">
        <h3 className="text-base font-semibold text-brand">📊 营业额报告</h3>
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
              🖨️ 打印 / 存 PDF
            </button>
          )}
        </div>
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}
      {!report && !error && <div className="text-sm text-gray-500">载入中...</div>}

      {report && (
        <div ref={printAreaRef}>
        <div className="reportDoc">
          <style>{REPORT_DOC_STYLE}</style>

          <div className="hd">
            <div className="brand">
              {CONTRACT_IMAGES.logo && <img src={CONTRACT_IMAGES.logo} alt="logo" />}
              <div>
                <div className="nm">{COMPANY.NAME}</div>
                <div className="sub">{report.transactionCount} 笔已收款项</div>
              </div>
            </div>
            <div className="titleBlock">
              <div className="title">REVENUE REPORT</div>
              <div className="titleMeta">
                {period === "month" && `报告月份: ${report.month}`}
                {period === "year" && `报告年份: ${report.year}`}
                {period === "all" && "累计总额 (至今)"}
              </div>
            </div>
          </div>

          <div className="statRow">
            <div className="stat">
              <div className="n">{fmtMoney(report.total)}</div>
              <div className="l">{PERIOD_LABELS[report.period]}营业额</div>
            </div>
          </div>

          <h4>🧾 按项目分类</h4>
          <table>
            <thead>
              <tr>
                <th>项目</th>
                <th className="num">金额</th>
              </tr>
            </thead>
            <tbody>
              {typeKeys.length === 0 && (
                <tr>
                  <td colSpan={2} className="empty">
                    这段时间没有收款记录
                  </td>
                </tr>
              )}
              {typeKeys.map((k) => (
                <tr key={k}>
                  <td>{PAYMENT_TYPE_LABELS[k]}</td>
                  <td className="num">
                    <b>{fmtMoney(report.byType[k])}</b>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <h4>🏢 按楼盘分类</h4>
          <table>
            <thead>
              <tr>
                <th>楼盘</th>
                <th className="num">金额</th>
              </tr>
            </thead>
            <tbody>
              {report.byProperty.length === 0 && (
                <tr>
                  <td colSpan={2} className="empty">
                    这段时间没有收款记录
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
