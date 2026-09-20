"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import PayslipDocument, { type PayslipData } from "@/components/PayslipDocument";
import { useToast } from "@/components/Toast";

interface Line {
  label: string;
  amount: number;
}
interface ApiData {
  months: string[];
  month: string;
  agent: { name: string; userCode: string; ic: string | null; bankName: string | null; bankAccountNumber: string | null };
  lines: Line[];
}

function monthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-MY", { month: "long", year: "numeric" });
}

export default function AgentPayslipClient() {
  const toast = useToast();
  const [data, setData] = useState<ApiData | null>(null);
  const [month, setMonth] = useState<string | null>(null);
  const [error, setError] = useState("");
  const printAreaRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (m?: string) => {
    setError("");
    try {
      const res = await fetch(`/api/contracts/agent-payslip${m ? `?month=${m}` : ""}`);
      const d = await res.json();
      if (!d.success) {
        setError(d.message);
        return;
      }
      setData(d);
      setMonth(d.month);
    } catch {
      setError("出错，请稍后再试");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  function print() {
    if (!printAreaRef.current) return;
    const html = printAreaRef.current.innerHTML;
    const w = window.open("", "_blank");
    if (!w) {
      toast.warning("浏览器拦截了弹出式窗口，请允许弹窗后再试一次");
      return;
    }
    w.document.write(
      `<html><head><title>Payslip - Bliss Rooms</title><meta charset="utf-8">` +
        `<style>body{margin:0;padding:34px;max-width:820px;margin:auto;}@media print{@page{margin:14mm;}}</style>` +
        `</head><body>${html}</body></html>`
    );
    w.document.close();
    setTimeout(() => w.print(), 400);
  }

  if (error) return <div className="rounded-xl bg-white p-5 text-sm text-red-600 shadow-sm">{error}</div>;
  if (!data || !month) return <div className="rounded-xl bg-white p-5 text-sm text-gray-500 shadow-sm">载入中...</div>;

  const payslip: PayslipData = {
    payPeriod: monthLabel(month),
    issuedDate: new Date().toISOString(),
    name: data.agent.name,
    staffId: data.agent.userCode,
    bankName: data.agent.bankName,
    position: "Posting Agent",
    icPassport: data.agent.ic,
    accountNo: data.agent.bankAccountNumber,
    earnings: data.lines,
    deductions: [],
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white p-5 shadow-sm">
        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-brand">📑 我的 Payslip</h3>
          {data.months.length > 0 && (
            <select
              className="input w-auto"
              value={month}
              onChange={(e) => load(e.target.value)}
            >
              {data.months.map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
            </select>
          )}
        </div>
        {data.months.length === 0 ? (
          <div className="py-6 text-center text-sm text-gray-400">还没有已发放的佣金记录</div>
        ) : (
          <>
            <div className="mb-3 text-right">
              <button onClick={print} className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800">
                🖨️ 打印 / 存 PDF
              </button>
            </div>
            <div ref={printAreaRef}>
              <PayslipDocument p={payslip} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
