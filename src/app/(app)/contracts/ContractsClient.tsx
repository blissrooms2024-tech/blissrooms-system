"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { contractStatusLabel, contractStatusTone } from "@/lib/config";
import { PILL } from "@/components/Pill";
import { fmtDate, fmtMoney as fmt } from "@/lib/format";
import { useLanguage } from "@/components/LanguageProvider";
import { useToast } from "@/components/Toast";
import ContractActions, { type ActionableContract } from "./ContractActions";

export interface Contract extends ActionableContract {
  roomCode?: string;
  expiredDate: string | null;
  remarks: string | null;
  renewedFromContractId: string | null;
  _due: number;
  _paid: number;
  _outstanding: number;
  _creditBalance: number;
  _expiringSoon?: boolean;
  _expired?: boolean;
  room?: { roomCode: string };
}

export const NOT_SIGNED_STATUSES = ["DRAFT", "PENDING_APPROVE", "PENDING_SIGN"];


export default function ContractsClient({ role }: { role: string }) {
  const { locale, t } = useLanguage();
  const toast = useToast();
  const [contracts, setContracts] = useState<Contract[] | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [quickFilter, setQuickFilter] = useState("");
  const [backfilling, setBackfilling] = useState(false);
  const [backfillingAgent, setBackfillingAgent] = useState(false);
  const [showExpired, setShowExpired] = useState(false);

  async function runProrataBackfill() {
    setBackfilling(true);
    try {
      const res = await fetch("/api/contracts/backfill-prorata-amount", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        load();
      } else {
        toast.danger(data.message);
      }
    } catch {
      toast.danger(t("网络连接失败，请检查网络后重试", "Network connection failed — please check your connection and try again"));
    } finally {
      setBackfilling(false);
    }
  }

  async function runCompanyAgentBackfill() {
    setBackfillingAgent(true);
    try {
      const res = await fetch("/api/contracts/backfill-company-agent", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        load();
      } else {
        toast.danger(data.message);
      }
    } catch {
      toast.danger(t("网络连接失败，请检查网络后重试", "Network connection failed — please check your connection and try again"));
    } finally {
      setBackfillingAgent(false);
    }
  }

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
    load();
  }, [load]);

  const canCreate = role === "AGENT" || role === "ADMIN";

  const q = search.trim().toLowerCase();
  const matched =
    contracts
      ?.filter((c) => {
        if (quickFilter === "OUTSTANDING" && !(c._outstanding > 0)) return false;
        if (quickFilter === "EXPIRING_SOON" && !c._expiringSoon) return false;
        if (quickFilter === "RENT_ESCALATED" && !c._rentEscalated) return false;
        if (quickFilter === "LEGACY_IMPORT" && !c.remarks?.includes("旧合同导入")) return false;
        if (quickFilter === "CREDIT_BALANCE" && !(c._creditBalance > 0)) return false;
        if (quickFilter === "NOT_SIGNED" && !NOT_SIGNED_STATUSES.includes(c.status)) return false;
        if (quickFilter === "RENEWAL" && !c.renewedFromContractId) return false;
        if (!q) return true;
        return (
          c.contractCode.toLowerCase().includes(q) ||
          (c.room?.roomCode ?? "").toLowerCase().includes(q) ||
          c.tenantName.toLowerCase().includes(q) ||
          c.agentName.toLowerCase().includes(q)
        );
      })
      .sort((a, b) =>
        quickFilter === "LEGACY_IMPORT" ? (a.room?.roomCode ?? "").localeCompare(b.room?.roomCode ?? "") : 0
      ) ?? null;
  // Already-expired (but not yet renewed/moved out) contracts get their own section below,
  // out of the main list — otherwise they drown out the contracts that actually still need
  // attention, and Admin has to scroll past a pile of dead leases to find them.
  const filteredContracts = matched?.filter((c) => !c._expired) ?? null;
  const expiredContracts = matched?.filter((c) => c._expired) ?? null;
  const nonExpiredTotal = contracts?.filter((c) => !c._expired).length ?? 0;

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
            {role === "ADMIN" && (
              <Link href="/contracts/duplicate-check" className="btn-soft text-sm">
                🔍 {t("重复账单检查", "Duplicate Bill Check")}
              </Link>
            )}
            {role === "ADMIN" && (
              <button
                onClick={runProrataBackfill}
                disabled={backfilling}
                title={t(
                  "补回旧合同的 Pro-rata 记录，让合同 PDF 也能显示出来 (可重复执行，不会重复计算)",
                  "Backfills older contracts' Pro-rata record so it also shows on the agreement PDF (safe to run more than once)"
                )}
                className="btn-soft text-sm disabled:opacity-50"
              >
                🔧 {backfilling ? t("处理中...", "Processing...") : t("补回 Pro-rata 记录", "Backfill Pro-rata")}
              </button>
            )}
            {role === "ADMIN" && (
              <button
                onClick={runCompanyAgentBackfill}
                disabled={backfillingAgent}
                title={t(
                  "把 Admin 自己直接开的旧合同，Agent 显示改成公司名字，并解除卡在等 Agent 签名的旧合同 (可重复执行)",
                  "Renames the Agent on older Admin-opened contracts to the company's own name, and unblocks any still stuck waiting on an Agent signature (safe to run more than once)"
                )}
                className="btn-soft text-sm disabled:opacity-50"
              >
                🏢 {backfillingAgent ? t("处理中...", "Processing...") : t("补正公司 Agent 合同", "Backfill Company Agent")}
              </button>
            )}
            {canCreate && (
              <Link href="/contracts/new" className="btn-primary text-sm">
                📝 {t("开新合同", "New Contract")}
              </Link>
            )}
          </div>
        </div>
        <div className="mb-3.5 flex flex-wrap gap-2.5">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("🔍 搜合同号 / 房间 / 租客 / Agent...", "🔍 Search contract # / room / tenant / agent...")}
            className="input max-w-xs flex-1"
          />
          <select value={quickFilter} onChange={(e) => setQuickFilter(e.target.value)} className="input max-w-[180px]">
            <option value="">{t("全部合同", "All Contracts")}</option>
            <option value="OUTSTANDING">{t("有欠款", "Has Outstanding")}</option>
            <option value="CREDIT_BALANCE">{t("有预付/预收余额", "Has Prepaid Credit")}</option>
            <option value="EXPIRING_SOON">{t("快到期", "Expiring Soon")}</option>
            <option value="RENT_ESCALATED">{t("租金逾期超10天", "Rent Overdue 10+ Days")}</option>
            <option value="NOT_SIGNED">{t("合同还没签名", "Not Yet Signed")}</option>
            <option value="RENEWAL">{t("续约建立的合同", "Renewal Contracts")}</option>
            <option value="LEGACY_IMPORT">{t("旧合同导入", "Legacy Import")}</option>
          </select>
        </div>
        {error && <div className="text-sm text-red-600">{error}</div>}
        {!contracts && !error && <div className="text-sm text-gray-500">{t("载入中...", "Loading...")}</div>}
        {contracts && contracts.length > 0 && (
          <div className="mb-1.5 text-xs text-gray-400 sm:hidden">
            👉 {t("表格可以左右滑动，查看「操作」按钮", "Scroll the table sideways to see the \"Actions\" buttons")}
          </div>
        )}
        {contracts && filteredContracts && (
          <div className="mb-2 text-xs text-gray-500">
            {filteredContracts.length === nonExpiredTotal
              ? t(`共 ${nonExpiredTotal} 份合同`, `${nonExpiredTotal} contracts total`)
              : t(
                  `共 ${filteredContracts.length} 份合同 (全部 ${nonExpiredTotal} 份中)`,
                  `${filteredContracts.length} shown (of ${nonExpiredTotal} total)`
                )}
          </div>
        )}
        {filteredContracts && (
          <ContractsTable
            contracts={filteredContracts}
            role={role}
            locale={locale}
            t={t}
            onChanged={load}
            emptyMessage={q ? t("没有符合条件的合同", "No contracts match") : t("还没有合同", "No contracts yet")}
          />
        )}
      </div>

      {expiredContracts && expiredContracts.length > 0 && (
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <button
            type="button"
            onClick={() => setShowExpired((v) => !v)}
            className="flex w-full items-center justify-between text-left"
          >
            <h3 className="text-base font-semibold text-gray-500">
              ⛔ {t("已过期合同", "Expired Contracts")} ({expiredContracts.length})
            </h3>
            <span className="text-sm text-gray-400">{showExpired ? t("收起 ▲", "Collapse ▲") : t("展开 ▼", "Expand ▼")}</span>
          </button>
          {showExpired && (
            <div className="mt-3.5">
              <ContractsTable
                contracts={expiredContracts}
                role={role}
                locale={locale}
                t={t}
                onChanged={load}
                emptyMessage={t("没有符合条件的合同", "No contracts match")}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ContractsTable({
  contracts,
  role,
  locale,
  t,
  onChanged,
  emptyMessage,
}: {
  contracts: Contract[];
  role: string;
  locale: "zh" | "en";
  t: (zh: string, en: string) => string;
  onChanged: () => void;
  emptyMessage: string;
}) {
  return (
    <div className="max-h-[65vh] overflow-auto">
      <table className="w-full text-sm">
        <thead>
          {/* sticky top-0 keeps the header (and the horizontal scrollbar, which sits right
              under this bounded box instead of under however many rows there are) always
              reachable without scrolling the whole page down first. */}
          <tr className="bg-gray-50 text-left text-gray-600">
            <Th className="sticky left-0 top-0 z-20 bg-gray-50">{t("合同号", "Contract #")}</Th>
            <Th className="sticky top-0 z-10 bg-gray-50">{t("房间", "Room")}</Th>
            <Th className="sticky top-0 z-10 bg-gray-50">{t("租客", "Tenant")}</Th>
            <Th className="sticky top-0 z-10 bg-gray-50">Agent</Th>
            <Th className="sticky top-0 z-10 bg-gray-50">{t("总款", "Total")}</Th>
            <Th className="sticky top-0 z-10 bg-gray-50">{t("已收", "Paid")}</Th>
            <Th className="sticky top-0 z-10 bg-gray-50">{t("还欠", "Owing")}</Th>
            <Th className="sticky top-0 z-10 bg-gray-50">{t("到期日", "Expiry Date")}</Th>
            <Th className="sticky top-0 z-10 bg-gray-50">{t("状态", "Status")}</Th>
            <Th className="sticky top-0 z-10 bg-gray-50">{t("操作", "Actions")}</Th>
          </tr>
        </thead>
        <tbody>
          {contracts.length === 0 && (
            <tr>
              <td colSpan={10} className="py-6 text-center text-gray-400">
                {emptyMessage}
              </td>
            </tr>
          )}
          {contracts.map((c) => (
            <tr key={c.contractCode} className="border-b border-gray-100 align-top">
              <Td className="sticky left-0 z-[1] bg-white shadow-[2px_0_4px_-2px_rgba(0,0,0,0.15)]">
                <Link href={`/contracts/${c.contractCode}`} className="font-bold text-brand hover:underline">
                  {c.contractCode}
                </Link>
              </Td>
              <Td>{c.room?.roomCode}</Td>
              <Td>{c.tenantName}</Td>
              <Td>{c.agentName}</Td>
              <Td>{fmt(c._due)}</Td>
              <Td>{fmt(c._paid)}</Td>
              <Td>
                {c._outstanding > 0 ? (
                  <span className="font-semibold text-red-600">{fmt(c._outstanding)}</span>
                ) : (
                  <span className={c._creditBalance > 0 ? "text-green-700" : "text-gray-700"}>{fmt(0)}</span>
                )}
                {c._creditBalance > 0 && (
                  <div className="whitespace-nowrap text-xs font-semibold text-green-700">
                    +{fmt(c._creditBalance)} {t("预付", "prepaid")}
                  </div>
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
                {c._expired ? (
                  <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-600">
                    ⛔ {t("已过期", "Expired")}
                  </span>
                ) : (
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${PILL[contractStatusTone(c.status)]}`}>
                    {contractStatusLabel(c.status, locale)}
                  </span>
                )}
                {c._rentEscalated && (
                  <div className="mt-1 whitespace-normal rounded bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600">
                    ⚠️ {t("租金逾期超10天", "Rent overdue 10+ days")}
                  </div>
                )}
              </Td>
              <Td>
                <ContractActions contract={c} role={role} onChanged={onChanged} />
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`whitespace-nowrap px-2.5 py-2 font-semibold ${className}`}>{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`whitespace-nowrap px-2.5 py-2.5 ${className}`}>{children}</td>;
}
