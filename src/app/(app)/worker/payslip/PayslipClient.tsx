"use client";

import { useEffect, useState, useCallback } from "react";

interface Job {
  requestCode: string;
  roomCode: string;
  title: string;
  cost: number | null;
  costPaidAt: string | null;
}

function fmt(v: number | null) {
  return v || v === 0 ? `RM${Number(v).toLocaleString()}` : "-";
}

export default function PayslipClient() {
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/worker/maintenance");
      const data = await res.json();
      if (!data.success) {
        setError(data.message);
        return;
      }
      setJobs(data.requests);
    } catch {
      setError("出错，请稍后再试");
    }
  }, []);

  useEffect(() => {
    // setState happens after the fetch's await, not synchronously in the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  if (!jobs && !error) return <div className="rounded-xl bg-white p-5 text-sm text-gray-500 shadow-sm">载入中...</div>;
  if (error) return <div className="rounded-xl bg-white p-5 text-sm text-red-600 shadow-sm">{error}</div>;

  const paidJobs = jobs!.filter((j) => j.costPaidAt && j.cost != null);
  const totalEarned = paidJobs.reduce((sum, j) => sum + Number(j.cost), 0);
  const thisMonth = new Date().toISOString().slice(0, 7);
  const thisMonthEarned = paidJobs
    .filter((j) => j.costPaidAt!.slice(0, 7) === thisMonth)
    .reduce((sum, j) => sum + Number(j.cost), 0);

  const byMonth = new Map<string, Job[]>();
  for (const j of paidJobs) {
    const month = j.costPaidAt!.slice(0, 7);
    if (!byMonth.has(month)) byMonth.set(month, []);
    byMonth.get(month)!.push(j);
  }
  const months = [...byMonth.keys()].sort((a, b) => b.localeCompare(a));

  return (
    <div className="rounded-xl bg-white p-5 shadow-sm">
      <h3 className="mb-3.5 text-base font-semibold text-brand">💰 我的薪水单</h3>
      <div className="mb-3.5 flex flex-wrap gap-3">
        <div className="rounded-lg bg-brand/5 px-4 py-2.5">
          <div className="text-xs text-gray-500">本月已领</div>
          <div className="text-lg font-semibold text-brand">{fmt(thisMonthEarned)}</div>
        </div>
        <div className="rounded-lg bg-gray-50 px-4 py-2.5">
          <div className="text-xs text-gray-500">累计已领</div>
          <div className="text-lg font-semibold text-gray-700">{fmt(totalEarned)}</div>
        </div>
      </div>
      {months.length === 0 ? (
        <div className="py-6 text-center text-sm text-gray-400">还没有工钱记录</div>
      ) : (
        <div className="space-y-3">
          {months.map((month) => {
            const rows = byMonth.get(month)!;
            const subtotal = rows.reduce((sum, j) => sum + Number(j.cost), 0);
            return (
              <div key={month}>
                <div className="mb-1 flex items-baseline justify-between">
                  <b className="text-sm">{month}</b>
                  <span className="text-sm font-semibold text-brand">{fmt(subtotal)}</span>
                </div>
                <div className="space-y-1 rounded-lg border border-gray-100 p-2">
                  {rows.map((j) => (
                    <div key={j.requestCode} className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600">
                      <span>🏠 {j.roomCode} · {j.title} · {j.costPaidAt}</span>
                      <span className="font-semibold text-gray-800">{fmt(j.cost)}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
