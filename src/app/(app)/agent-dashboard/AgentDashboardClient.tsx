"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fmtMoney } from "@/lib/format";

interface LeaderRow {
  userCode: string;
  name: string;
  total: number;
  thisMonth: number;
  isMe: boolean;
}
interface Data {
  stats: { totalContracts: number; thisMonth: number; occupiedRooms: number; commissionPaid: number; commissionPending: number };
  leaderboard: LeaderRow[];
}

const MEDAL = ["🥇", "🥈", "🥉"];

export default function AgentDashboardClient() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/contracts/agent-dashboard")
      .then((r) => r.json())
      .then((d) => {
        if (!d.success) {
          setError(d.message);
          return;
        }
        setData(d);
      })
      .catch(() => setError("出错，请稍后再试"));
  }, []);

  if (error) return <div className="rounded-xl bg-white p-5 text-sm text-red-600 shadow-sm">{error}</div>;
  if (!data) return <div className="rounded-xl bg-white p-5 text-sm text-gray-500 shadow-sm">载入中...</div>;

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white p-5 shadow-sm">
        <h3 className="mb-3.5 text-base font-semibold text-brand">📊 我的总览</h3>
        <div className="flex flex-wrap gap-3.5">
          <Box n={data.stats.totalContracts} l="总成交合同" href="/agent-report?period=all" />
          <Box n={data.stats.thisMonth} l="本月新增" href="/agent-report?period=month" />
          <Box n={data.stats.occupiedRooms} l="出租中房间" href="/agent-report?period=all" />
          <Box n={fmtMoney(data.stats.commissionPaid)} l="佣金已发" color="text-green-700" href="/agent-commission" />
          <Box n={fmtMoney(data.stats.commissionPending)} l="佣金待发" color="text-amber-600" href="/agent-commission" />
        </div>
      </div>

      <div className="rounded-xl bg-white p-5 shadow-sm">
        <h3 className="mb-3.5 text-base font-semibold text-brand">🏆 Top Sales 排行榜</h3>
        {data.leaderboard.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-400">还没有成交记录</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-gray-600">
                <th className="px-2.5 py-1.5 font-semibold">排名</th>
                <th className="px-2.5 py-1.5 font-semibold">Agent</th>
                <th className="px-2.5 py-1.5 font-semibold">总成交合同</th>
                <th className="px-2.5 py-1.5 font-semibold">本月新增</th>
              </tr>
            </thead>
            <tbody>
              {data.leaderboard.map((a, i) => (
                <tr key={a.userCode} className={`border-b border-gray-100 ${a.isMe ? "bg-brand-light/30" : ""}`}>
                  <td className="px-2.5 py-1.5 font-semibold">{MEDAL[i] ?? `#${i + 1}`}</td>
                  <td className="px-2.5 py-1.5">
                    {a.name}
                    {a.isMe && <span className="ml-1.5 text-xs font-semibold text-brand">(我)</span>}
                  </td>
                  <td className="px-2.5 py-1.5 font-semibold text-brand">{a.total}</td>
                  <td className="px-2.5 py-1.5">{a.thisMonth}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Box({ n, l, color, href }: { n: number | string; l: string; color?: string; href: string }) {
  return (
    <Link
      href={href}
      className="min-w-[130px] flex-1 rounded-xl bg-gray-50 p-3.5 text-center transition hover:bg-brand-light"
    >
      <div className={`text-2xl font-bold ${color ?? "text-brand"}`}>{n}</div>
      <div className="text-xs text-gray-500">{l}</div>
    </Link>
  );
}
