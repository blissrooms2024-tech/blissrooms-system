"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { contractStatusLabel } from "@/lib/config";
import { fmtMoney } from "@/lib/format";
import { useLanguage } from "@/components/LanguageProvider";

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
  const { locale, t } = useLanguage();
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
      .catch(() => setError(t("出错，请稍后再试", "Something went wrong, please try again later")));
  }, [t]);

  if (error) return <div className="rounded-xl bg-white p-5 text-sm text-red-600 shadow-sm">{error}</div>;
  if (!data) return <div className="rounded-xl bg-white p-5 text-sm text-gray-500 shadow-sm">{t("载入中...", "Loading...")}</div>;

  const pending = data.contracts.filter(
    (c) => c.status !== "ACTIVE" || !c.tenantSigned || !c.icDone || !c.moveInDone || c.depositOutstanding > 0
  );

  return (
    <div className="rounded-xl bg-white p-5 shadow-sm">
      <h3 className="mb-3.5 text-base font-semibold text-brand">📋 {t("Tenant 进度 (还没完成的)", "Tenant Progress (Not Completed)")}</h3>
      {pending.length === 0 ? (
        <div className="py-8 text-center text-sm text-gray-400">🎉 {t("全部都完成了", "Everything is completed")}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-gray-600">
                <th className="px-2.5 py-1.5 font-semibold">{t("合同", "Contract")}</th>
                <th className="px-2.5 py-1.5 font-semibold">{t("租客", "Tenant")}</th>
                <th className="px-2.5 py-1.5 font-semibold">{t("状态", "Status")}</th>
                <th className="px-2.5 py-1.5 font-semibold">{t("Tenant 签名", "Tenant Signature")}</th>
                <th className="px-2.5 py-1.5 font-semibold">IC</th>
                <th className="px-2.5 py-1.5 font-semibold">Move-in</th>
                <th className="px-2.5 py-1.5 font-semibold">{t("押金", "Deposit")}</th>
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
                  <td className="px-2.5 py-1.5">{contractStatusLabel(c.status, locale)}</td>
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
                      <span className="font-semibold text-red-600">{t("欠", "Owes")} {fmtMoney(c.depositOutstanding)}</span>
                    ) : (
                      <span className="text-green-600">✅ {t("收齐", "Fully Collected")}</span>
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
