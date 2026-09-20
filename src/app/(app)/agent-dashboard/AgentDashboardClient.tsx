"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CONTRACT_STATUS_LABELS } from "@/lib/config";
import { fmtMoney } from "@/lib/format";

interface ContractRow {
  contractCode: string;
  roomCode: string;
  tenantName: string;
  status: string;
  agentSigned: boolean;
  tenantSigned: boolean;
  icDone: boolean;
  moveInDone: boolean;
  depositDue: number;
  depositPaid: number;
  depositOutstanding: number;
  commAmount: number | null;
  commStatus: string | null;
}
interface LeaderRow {
  userCode: string;
  name: string;
  total: number;
  thisMonth: number;
  isMe: boolean;
}
interface Data {
  stats: { totalContracts: number; thisMonth: number; occupiedRooms: number; commissionPaid: number; commissionPending: number };
  contracts: ContractRow[];
  leaderboard: LeaderRow[];
}

function Check({ ok }: { ok: boolean }) {
  return <span className={ok ? "text-green-600" : "text-red-500"}>{ok ? "✅" : "✗"}</span>;
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

  const pending = data.contracts.filter(
    (c) => c.status !== "ACTIVE" || !c.tenantSigned || !c.icDone || !c.moveInDone || c.depositOutstanding > 0
  );

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white p-5 shadow-sm">
        <h3 className="mb-3.5 text-base font-semibold text-brand">📊 我的总览</h3>
        <div className="flex flex-wrap gap-3.5">
          <Box n={data.stats.totalContracts} l="总成交合同" />
          <Box n={data.stats.thisMonth} l="本月新增" />
          <Box n={data.stats.occupiedRooms} l="出租中房间" />
          <Box n={fmtMoney(data.stats.commissionPaid)} l="佣金已发" color="text-green-700" />
          <Box n={fmtMoney(data.stats.commissionPending)} l="佣金待发" color="text-amber-600" />
        </div>
      </div>

      <div className="rounded-xl bg-white p-5 shadow-sm">
        <h3 className="mb-3.5 text-base font-semibold text-brand">📋 Tenant 进度 (还没完成的)</h3>
        {pending.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-400">🎉 全部都完成了</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-gray-600">
                  <th className="px-2.5 py-1.5 font-semibold">合同</th>
                  <th className="px-2.5 py-1.5 font-semibold">租客</th>
                  <th className="px-2.5 py-1.5 font-semibold">状态</th>
                  <th className="px-2.5 py-1.5 font-semibold">Tenant 签名</th>
                  <th className="px-2.5 py-1.5 font-semibold">IC</th>
                  <th className="px-2.5 py-1.5 font-semibold">Move-in</th>
                  <th className="px-2.5 py-1.5 font-semibold">押金</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((c) => (
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
                      <Check ok={c.tenantSigned} />
                    </td>
                    <td className="px-2.5 py-1.5">
                      <Check ok={c.icDone} />
                    </td>
                    <td className="px-2.5 py-1.5">
                      <Check ok={c.moveInDone} />
                    </td>
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

      <div className="rounded-xl bg-white p-5 shadow-sm">
        <h3 className="mb-3.5 text-base font-semibold text-brand">💰 我的佣金</h3>
        {data.contracts.filter((c) => c.commAmount !== null).length === 0 ? (
          <div className="py-6 text-center text-sm text-gray-400">Admin 还没有帮任何合同填佣金金额</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-gray-600">
                <th className="px-2.5 py-1.5 font-semibold">合同</th>
                <th className="px-2.5 py-1.5 font-semibold">租客</th>
                <th className="px-2.5 py-1.5 font-semibold">佣金</th>
                <th className="px-2.5 py-1.5 font-semibold">状态</th>
              </tr>
            </thead>
            <tbody>
              {data.contracts
                .filter((c) => c.commAmount !== null)
                .map((c) => (
                  <tr key={c.contractCode} className="border-b border-gray-100">
                    <td className="px-2.5 py-1.5">{c.contractCode}</td>
                    <td className="px-2.5 py-1.5">{c.tenantName}</td>
                    <td className="px-2.5 py-1.5 font-semibold">{fmtMoney(c.commAmount)}</td>
                    <td className="px-2.5 py-1.5">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          c.commStatus === "Paid" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {c.commStatus === "Paid" ? "已发" : "待发"}
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
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

function Box({ n, l, color }: { n: number | string; l: string; color?: string }) {
  return (
    <div className="min-w-[130px] flex-1 rounded-xl bg-gray-50 p-3.5 text-center">
      <div className={`text-2xl font-bold ${color ?? "text-brand"}`}>{n}</div>
      <div className="text-xs text-gray-500">{l}</div>
    </div>
  );
}
