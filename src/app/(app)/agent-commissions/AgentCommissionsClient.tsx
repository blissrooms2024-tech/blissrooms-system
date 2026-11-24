"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useToast } from "@/components/Toast";
import { useLanguage } from "@/components/LanguageProvider";
import { fmtDate, fmtMoney as fmt } from "@/lib/format";
import ConfirmDialog from "@/components/ConfirmDialog";

interface CommissionRow {
  contractCode: string;
  roomCode: string;
  tenantName: string;
  agentName: string;
  agentUserCode: string;
  commAmount: number;
  commStatus: string;
  commPaidAt: string | null;
}

export default function AgentCommissionsClient({ canAct }: { canAct: boolean }) {
  const toast = useToast();
  const { t } = useLanguage();
  const [items, setItems] = useState<CommissionRow[] | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [agentFilter, setAgentFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [paying, setPaying] = useState<CommissionRow | null>(null);
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [paySaving, setPaySaving] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/contracts/agent-commissions");
      const data = await res.json();
      if (!data.success) {
        setError(data.message);
        return;
      }
      setItems(data.contracts);
    } catch {
      setError(t("出错，请稍后再试", "Something went wrong — please try again later"));
    }
  }, [t]);

  useEffect(() => {
    // setState happens after the fetch's await, not synchronously in the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function payOne(contractCode: string) {
    const res = await fetch(`/api/contracts/${contractCode}/pay-commission`, { method: "POST" });
    const data = await res.json();
    if (data.success) toast.success(data.message);
    else toast.danger(data.message);
    return data.success as boolean;
  }

  async function confirmPayOne() {
    if (!paying) return;
    setPaySaving(true);
    try {
      await payOne(paying.contractCode);
    } finally {
      setPaying(null);
      setPaySaving(false);
      load();
    }
  }

  async function confirmBulkPay() {
    setPaySaving(true);
    try {
      const codes = [...selectedIds];
      const results = await Promise.all(codes.map((c) => payOne(c)));
      const okCount = results.filter(Boolean).length;
      const failCount = results.length - okCount;
      if (failCount === 0) {
        toast.success(t(`✅ 已发放 ${okCount} 笔佣金`, `✅ Paid ${okCount} commissions`));
      } else {
        toast.danger(t(`发放了 ${okCount} 笔，${failCount} 笔失败`, `Paid ${okCount}, ${failCount} failed`));
      }
    } finally {
      setBulkConfirmOpen(false);
      setSelectedIds(new Set());
      setPaySaving(false);
      load();
    }
  }

  function toggleSelected(code: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  if (error) return <div className="rounded-xl bg-white p-5 text-sm text-red-600 shadow-sm">{error}</div>;
  if (!items) return <div className="rounded-xl bg-white p-5 text-sm text-gray-500 shadow-sm">{t("载入中...", "Loading...")}</div>;

  const agentNames = [...new Set(items.map((c) => c.agentName))].sort();
  const q = search.trim().toLowerCase();
  const filtered = items.filter((c) => {
    if (agentFilter && c.agentName !== agentFilter) return false;
    if (statusFilter && c.commStatus !== statusFilter) return false;
    if (!q) return true;
    return (
      c.contractCode.toLowerCase().includes(q) ||
      c.roomCode.toLowerCase().includes(q) ||
      c.tenantName.toLowerCase().includes(q) ||
      c.agentName.toLowerCase().includes(q)
    );
  });
  const selectablePending = filtered.filter((c) => c.commStatus !== "Paid");
  const totalPending = filtered.filter((c) => c.commStatus !== "Paid").reduce((s, c) => s + c.commAmount, 0);
  const totalPaid = filtered.filter((c) => c.commStatus === "Paid").reduce((s, c) => s + c.commAmount, 0);

  return (
    <div className="rounded-xl bg-white p-5 shadow-sm">
      <h3 className="mb-3.5 text-base font-semibold text-brand">💰 {t("Agent 佣金", "Agent Commissions")}</h3>
      <p className="mb-3.5 text-xs text-gray-500">
        {t(
          "佣金金额在「编辑合同」里填，这里才是真正发放的地方——发放的时候会自动记一笔对应的支出，合同上的金额一旦发放了就锁住不能再改。",
          "The amount itself is entered via Edit Contract — this is where it actually gets paid out, which books a matching Expense automatically. Once paid, the amount on the contract is locked."
        )}
      </p>

      <div className="mb-3.5 flex flex-wrap gap-2.5">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("🔍 搜合同号 / 房间 / 租客 / Agent...", "🔍 Search contract # / room / tenant / agent...")}
          className="input max-w-xs flex-1"
        />
        <select value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)} className="input max-w-[180px]">
          <option value="">{t("全部 Agent", "All Agents")}</option>
          {agentNames.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input max-w-[160px]">
          <option value="">{t("全部状态", "All Statuses")}</option>
          <option value="Pending">{t("待发", "Pending")}</option>
          <option value="Paid">{t("已发", "Paid")}</option>
        </select>
      </div>

      <div className="mb-3.5 flex flex-wrap gap-3">
        <div className="rounded-lg bg-amber-50 px-4 py-2.5">
          <div className="text-xs text-gray-500">{t("待发总额", "Pending Total")}</div>
          <div className="text-lg font-semibold text-amber-700">{fmt(totalPending)}</div>
        </div>
        <div className="rounded-lg bg-green-50 px-4 py-2.5">
          <div className="text-xs text-gray-500">{t("已发总额", "Paid Total")}</div>
          <div className="text-lg font-semibold text-green-700">{fmt(totalPaid)}</div>
        </div>
      </div>

      <div className="mb-2 text-xs text-gray-500">
        {filtered.length === items.length
          ? t(`共 ${items.length} 笔`, `${items.length} total`)
          : t(`共 ${filtered.length} 笔 (全部 ${items.length} 笔中)`, `${filtered.length} shown (of ${items.length} total)`)}
      </div>

      {canAct && selectedIds.size > 0 && (
        <div className="mb-3.5 flex items-center gap-2.5 rounded-lg bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
          <span className="font-semibold">{t(`已选 ${selectedIds.size} 笔`, `${selectedIds.size} selected`)}</span>
          <button
            onClick={() => setBulkConfirmOpen(true)}
            className="rounded-md bg-amber-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-700"
          >
            💰 {t("批量发放", "Pay Selected")}
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="rounded-md bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-200"
          >
            {t("取消选择", "Clear Selection")}
          </button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="py-8 text-center text-gray-400">{t("没有符合条件的记录", "No records match your filters")}</div>
      ) : (
        <div className="max-h-[65vh] overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-gray-600">
                {canAct && (
                  <th className="sticky top-0 z-10 bg-gray-50 px-2.5 py-1.5 font-semibold">
                    <input
                      type="checkbox"
                      checked={selectablePending.length > 0 && selectablePending.every((c) => selectedIds.has(c.contractCode))}
                      onChange={(e) => {
                        setSelectedIds((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) selectablePending.forEach((c) => next.add(c.contractCode));
                          else selectablePending.forEach((c) => next.delete(c.contractCode));
                          return next;
                        });
                      }}
                    />
                  </th>
                )}
                <th className="sticky top-0 z-10 bg-gray-50 px-2.5 py-1.5 font-semibold">{t("合同", "Contract")}</th>
                <th className="sticky top-0 z-10 bg-gray-50 px-2.5 py-1.5 font-semibold">Agent</th>
                <th className="sticky top-0 z-10 bg-gray-50 px-2.5 py-1.5 font-semibold">{t("金额", "Amount")}</th>
                <th className="sticky top-0 z-10 bg-gray-50 px-2.5 py-1.5 font-semibold">{t("状态", "Status")}</th>
                <th className="sticky top-0 z-10 bg-gray-50 px-2.5 py-1.5 font-semibold">{t("发放日期", "Paid Date")}</th>
                {canAct && <th className="sticky top-0 z-10 bg-gray-50 px-2.5 py-1.5 font-semibold">{t("操作", "Actions")}</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const isPaid = c.commStatus === "Paid";
                return (
                  <tr key={c.contractCode} className="border-b border-gray-100">
                    {canAct && (
                      <td className="px-2.5 py-1.5">
                        {!isPaid && (
                          <input
                            type="checkbox"
                            checked={selectedIds.has(c.contractCode)}
                            onChange={() => toggleSelected(c.contractCode)}
                          />
                        )}
                      </td>
                    )}
                    <td className="px-2.5 py-1.5">
                      <Link href={`/contracts/${c.contractCode}`} className="text-brand hover:underline">
                        {c.contractCode}
                      </Link>
                      <div className="text-xs text-gray-500">
                        {c.roomCode} · {c.tenantName}
                      </div>
                    </td>
                    <td className="px-2.5 py-1.5">{c.agentName}</td>
                    <td className="px-2.5 py-1.5 font-semibold">{fmt(c.commAmount)}</td>
                    <td className="px-2.5 py-1.5">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          isPaid ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {isPaid ? t("已发", "Paid") : t("待发", "Pending")}
                      </span>
                    </td>
                    <td className="px-2.5 py-1.5 text-gray-600">{fmtDate(c.commPaidAt)}</td>
                    {canAct && (
                      <td className="px-2.5 py-1.5">
                        {!isPaid && (
                          <button
                            onClick={() => setPaying(c)}
                            className="rounded-md bg-amber-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-600"
                          >
                            💰 {t("发放", "Pay")}
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={!!paying}
        title={t("发放佣金", "Pay Commission")}
        message={t(
          `确定要发放 ${paying?.agentName} 的佣金 ${paying ? fmt(paying.commAmount) : ""} (合同 ${paying?.contractCode}) 吗？会自动记一笔支出，发放后金额不能再改。`,
          `Pay ${paying?.agentName}'s commission ${paying ? fmt(paying.commAmount) : ""} (contract ${paying?.contractCode})? This books a matching Expense automatically, and the amount can't be changed afterward.`
        )}
        confirmLabel={paySaving ? t("处理中...", "Processing...") : t("确定发放", "Confirm Pay")}
        onConfirm={confirmPayOne}
        onCancel={() => setPaying(null)}
      />

      <ConfirmDialog
        open={bulkConfirmOpen}
        title={t("批量发放佣金", "Pay Selected Commissions")}
        message={t(
          `确定要发放这 ${selectedIds.size} 笔佣金吗？会各自记一笔支出，发放后金额不能再改。`,
          `Pay these ${selectedIds.size} commissions? Each books its own matching Expense, and amounts can't be changed afterward.`
        )}
        confirmLabel={paySaving ? t("处理中...", "Processing...") : t("确定发放", "Confirm Pay")}
        onConfirm={confirmBulkPay}
        onCancel={() => setBulkConfirmOpen(false)}
      />
    </div>
  );
}
