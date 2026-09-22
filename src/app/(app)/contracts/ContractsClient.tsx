"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { contractStatusLabel } from "@/lib/config";
import { fmtDate } from "@/lib/format";
import { useLanguage } from "@/components/LanguageProvider";
import ContractActions, { type ActionableContract } from "./ContractActions";

interface Contract extends ActionableContract {
  roomCode?: string;
  expiredDate: string | null;
  _paid: number;
  _outstanding: number;
  _expiringSoon?: boolean;
  room?: { roomCode: string };
}

function fmt(v: number) {
  return v || v === 0 ? `RM${Number(v).toLocaleString()}` : "-";
}

export default function ContractsClient({ role }: { role: string }) {
  const { locale, t } = useLanguage();
  const [contracts, setContracts] = useState<Contract[] | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/contracts/page-data");
      let data;
      try {
        data = await res.json();
      } catch {
        setError(t(`服务器出错 (HTTP ${res.status})，请稍后再试或截图给开发者`, `Server error (HTTP ${res.status}) — please try again later or screenshot this for the developer`));
        return;
      }
      if (!data.success) {
        setError(data.message);
        return;
      }
      setContracts(data.contracts);
    } catch {
      setError(t("网络连接失败，请检查网络后重试", "Network connection failed — please check your connection and try again"));
    }
  }, [t]);

  useEffect(() => {
    // setState happens after the fetch's await, not synchronously in the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const canCreate = role === "AGENT" || role === "ADMIN";

  const q = search.trim().toLowerCase();
  const filteredContracts =
    contracts?.filter((c) => {
      if (!q) return true;
      return (
        c.contractCode.toLowerCase().includes(q) ||
        (c.room?.roomCode ?? "").toLowerCase().includes(q) ||
        c.tenantName.toLowerCase().includes(q) ||
        c.agentName.toLowerCase().includes(q)
      );
    }) ?? null;

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white p-5 shadow-sm">
        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2.5">
          <h3 className="text-base font-semibold text-brand">{t("合同清单", "Contracts")}</h3>
          <div className="flex items-center gap-2">
            {role === "ADMIN" && (
              <Link href="/contracts/renewal" className="btn-soft text-sm">
                🔄 {t("续约管理", "Renewals")}
              </Link>
            )}
            {role === "ADMIN" && (
              <Link href="/contracts/import" className="btn-soft text-sm">
                📥 {t("导入旧合同", "Import Legacy")}
              </Link>
            )}
            {canCreate && (
              <Link href="/contracts/new" className="btn-primary text-sm">
                📝 {t("开新合同", "New Contract")}
              </Link>
            )}
          </div>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("🔍 搜合同号 / 房间 / 租客 / Agent...", "🔍 Search contract # / room / tenant / agent...")}
          className="input mb-3.5 max-w-xs"
        />
        {error && <div className="text-sm text-red-600">{error}</div>}
        {!contracts && !error && <div className="text-sm text-gray-500">{t("载入中...", "Loading...")}</div>}
        {contracts && contracts.length > 0 && (
          <div className="mb-1.5 text-xs text-gray-400 sm:hidden">
            👉 {t("表格可以左右滑动，查看「操作」按钮", "Scroll the table sideways to see the \"Actions\" buttons")}
          </div>
        )}
        {filteredContracts && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-gray-600">
                  <Th className="sticky left-0 z-[1] bg-gray-50">{t("合同号", "Contract #")}</Th>
                  <Th>{t("房间", "Room")}</Th>
                  <Th>{t("租客", "Tenant")}</Th>
                  <Th>Agent</Th>
                  <Th>{t("总款", "Total")}</Th>
                  <Th>{t("已收", "Paid")}</Th>
                  <Th>{t("还欠", "Owing")}</Th>
                  <Th>{t("到期日", "Expiry Date")}</Th>
                  <Th>{t("状态", "Status")}</Th>
                  <Th>{t("操作", "Actions")}</Th>
                </tr>
              </thead>
              <tbody>
                {filteredContracts.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-6 text-center text-gray-400">
                      {q ? t("没有符合条件的合同", "No contracts match") : t("还没有合同", "No contracts yet")}
                    </td>
                  </tr>
                )}
                {filteredContracts.map((c) => (
                  <tr key={c.contractCode} className="border-b border-gray-100 align-top">
                    <Td className="sticky left-0 z-[1] bg-white shadow-[2px_0_4px_-2px_rgba(0,0,0,0.15)]">
                      <Link href={`/contracts/${c.contractCode}`} className="font-bold text-brand hover:underline">
                        {c.contractCode}
                      </Link>
                    </Td>
                    <Td>{c.room?.roomCode}</Td>
                    <Td>{c.tenantName}</Td>
                    <Td>{c.agentName}</Td>
                    <Td>{fmt(c.totalOutstanding)}</Td>
                    <Td>{fmt(c._paid)}</Td>
                    <Td>
                      {c._outstanding > 0 ? (
                        <span className="font-semibold text-red-600">{fmt(c._outstanding)}</span>
                      ) : (
                        <span className="text-green-700">✅{t("清", "Settled")}</span>
                      )}
                    </Td>
                    <Td>
                      {fmtDate(c.expiredDate)}
                      {c._expiringSoon && (
                        <div className="mt-1 whitespace-normal rounded bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                          ⏰ {t("快到期", "Expiring Soon")}
                        </div>
                      )}
                    </Td>
                    <Td>
                      <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-600">
                        {contractStatusLabel(c.status, locale)}
                      </span>
                      {c._rentEscalated && (
                        <div className="mt-1 whitespace-normal rounded bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600">
                          ⚠️ {t("租金逾期超10天", "Rent overdue 10+ days")}
                        </div>
                      )}
                    </Td>
                    <Td>
                      <ContractActions contract={c} role={role} onChanged={load} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`whitespace-nowrap px-2.5 py-2 font-semibold ${className}`}>{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`whitespace-nowrap px-2.5 py-2.5 ${className}`}>{children}</td>;
}
