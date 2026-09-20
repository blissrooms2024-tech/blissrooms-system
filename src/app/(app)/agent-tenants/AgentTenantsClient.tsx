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
  tenantSigned: boolean;
  icDone: boolean;
  moveInDone: boolean;
  depositOutstanding: number;
}
interface Data {
  contracts: ContractRow[];
}

function Check({ ok }: { ok: boolean }) {
  return <span className={ok ? "text-green-600" : "text-red-500"}>{ok ? "✅" : "✗"}</span>;
}

export default function AgentTenantsClient() {
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
  );
}
