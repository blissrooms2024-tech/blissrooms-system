"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fmtMoney } from "@/lib/format";
import { useLanguage } from "@/components/LanguageProvider";

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
  const { t } = useLanguage();
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

  const rows = data.contracts.filter((c) => c.commAmount !== null);

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white p-5 shadow-sm">
        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-brand">💰 {t("我的佣金", "My Commission")}</h3>
          <Link href="/agent-payslip" className="btn-soft px-3.5 py-1.5 text-xs">
            📑 {t("查看 Payslip", "View Payslip")}
          </Link>
        </div>
        <div className="flex flex-wrap gap-3.5">
          <Box n={fmtMoney(data.stats.commissionPaid)} l={t("佣金已发", "Commission Paid")} color="text-green-700" />
          <Box n={fmtMoney(data.stats.commissionPending)} l={t("佣金待发", "Commission Pending")} color="text-amber-600" />
        </div>
      </div>

      <div className="rounded-xl bg-white p-5 shadow-sm">
        {rows.length === 0 ? (
          <div className="py-6 text-center text-sm text-gray-400">{t("Admin 还没有帮任何合同填佣金金额", "Admin hasn't filled in a commission amount for any contract yet")}</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-gray-600">
                <th className="px-2.5 py-1.5 font-semibold">{t("合同", "Contract")}</th>
                <th className="px-2.5 py-1.5 font-semibold">{t("租客", "Tenant")}</th>
                <th className="px-2.5 py-1.5 font-semibold">{t("佣金", "Commission")}</th>
                <th className="px-2.5 py-1.5 font-semibold">{t("状态", "Status")}</th>
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
                      {c.commStatus === "Paid" ? t("已发", "Paid") : t("待发", "Pending")}
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
