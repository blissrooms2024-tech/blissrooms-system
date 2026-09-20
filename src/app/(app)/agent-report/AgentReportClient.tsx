"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CONTRACT_STATUS_LABELS } from "@/lib/config";
import { fmtMoney, fmtDate } from "@/lib/format";
import { useToast } from "@/components/Toast";

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

const PERIOD_LABELS: Record<Period, string> = { month: "本月", year: "本年", all: "累计" };

export default function AgentReportClient() {
  const toast = useToast();
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
      `<html><head><title>我的合同报告 - Bliss Rooms</title><meta charset="utf-8">` +
        `<style>body{margin:0;padding:34px;font-family:Arial,sans-serif;}table{width:100%;border-collapse:collapse;margin-top:10px;}` +
        `td,th{border:1px solid #999;padding:6px 10px;font-size:13px;text-align:left;}@media print{@page{margin:14mm;}}</style>` +
        `</head><body>${html}</body></html>`
    );
    w.document.close();
    setTimeout(() => w.print(), 400);
  }

  const years = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i);

  return (
    <div className="rounded-xl bg-white p-5 shadow-sm">
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2.5 no-print">
        <h3 className="text-base font-semibold text-brand">📊 我的合同报告</h3>
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
          <div className="mb-4 border-b border-gray-200 pb-3.5">
            <div className="text-lg font-bold text-brand">我的合同报告</div>
            <div className="text-sm text-gray-500">
              {period === "month" && `报告月份: ${report.month}`}
              {period === "year" && `报告年份: ${report.year}`}
              {period === "all" && "累计 (至今)"}
            </div>
          </div>

          <div className="mb-4 flex flex-wrap gap-3.5">
            <Box n={report.stats.newContracts} l={period === "all" ? "总成交合同" : "新增合同"} />
            <Box n={report.stats.activeRooms} l="出租中房间" />
            <Box n={fmtMoney(report.stats.totalRent)} l="出租中总租金/月" />
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-gray-600">
                <th className="px-2.5 py-1.5 font-semibold">合同</th>
                <th className="px-2.5 py-1.5 font-semibold">租客</th>
                <th className="px-2.5 py-1.5 font-semibold">状态</th>
                <th className="px-2.5 py-1.5 font-semibold">开始~到期</th>
                <th className="px-2.5 py-1.5 font-semibold">租金</th>
                <th className="px-2.5 py-1.5 font-semibold">押金</th>
              </tr>
            </thead>
            <tbody>
              {report.contracts.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-gray-400">
                    这段时间没有合同记录
                  </td>
                </tr>
              )}
              {report.contracts.map((c) => (
                <tr key={c.contractCode} className="border-b border-gray-100">
                  <td className="px-2.5 py-1.5">
                    <Link href={`/contracts/${c.contractCode}`} className="font-semibold text-brand hover:underline">
                      {c.contractCode}
                    </Link>{" "}
                    · {c.roomCode}
                  </td>
                  <td className="px-2.5 py-1.5">{c.tenantName}</td>
                  <td className="px-2.5 py-1.5">{CONTRACT_STATUS_LABELS[c.status] ?? c.status}</td>
                  <td className="px-2.5 py-1.5">
                    {fmtDate(c.commencementDate)} ~ {fmtDate(c.expiredDate)}
                  </td>
                  <td className="px-2.5 py-1.5">{fmtMoney(c.roomRental + c.carparkRental)}</td>
                  <td className="px-2.5 py-1.5">
                    {c.depositOutstanding > 0 ? (
                      <span className="font-semibold text-red-600">欠 {fmtMoney(c.depositOutstanding)}</span>
                    ) : (
                      <span className="text-green-600">✅ 收齐</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Box({ n, l }: { n: number | string; l: string }) {
  return (
    <div className="min-w-[140px] flex-1 rounded-xl bg-gray-50 p-3.5 text-center">
      <div className="text-2xl font-bold text-brand">{n}</div>
      <div className="text-xs text-gray-500">{l}</div>
    </div>
  );
}
