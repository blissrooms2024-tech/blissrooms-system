"use client";

import { useEffect, useState } from "react";
import { fmtMoney } from "@/lib/format";

interface ContractRow {
  contractCode: string;
  tenantName: string;
  commAmount: number | null;
  commStatus: string | null;
}
interface Data {
  stats: { commissionPaid: number; commissionPending: number };
  contracts: ContractRow[];
}

export default function AgentCommissionClient() {
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

  const rows = data.contracts.filter((c) => c.commAmount !== null);

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white p-5 shadow-sm">
        <h3 className="mb-3.5 text-base font-semibold text-brand">💰 我的佣金</h3>
        <div className="flex flex-wrap gap-3.5">
          <Box n={fmtMoney(data.stats.commissionPaid)} l="佣金已发" color="text-green-700" />
          <Box n={fmtMoney(data.stats.commissionPending)} l="佣金待发" color="text-amber-600" />
        </div>
      </div>

      <div className="rounded-xl bg-white p-5 shadow-sm">
        {rows.length === 0 ? (
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
              {rows.map((c) => (
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
