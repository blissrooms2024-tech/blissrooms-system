"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/Toast";
import { useLanguage } from "@/components/LanguageProvider";

interface ActiveContract {
  contractCode: string;
  roomCode: string;
  tenantName: string;
  roomRental: number;
}

/** Manual one-off rental bill for a single room/contract — for cases the automatic monthly
 * cycle doesn't cover, e.g. a tenant who was unverified when the cron ran and needs a bill
 * backfilled for a specific (possibly past) month once they're verified. Admin picks the
 * room, types the amount and due date themselves rather than relying on the contract's own
 * roomRental and the next-5th default the monthly job always uses. */
export default function OpenRentalBillCard() {
  const toast = useToast();
  const { t } = useLanguage();
  const [contracts, setContracts] = useState<ActiveContract[]>([]);
  const [contractCode, setContractCode] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [periodMonth, setPeriodMonth] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/contracts/page-data");
      const data = await res.json();
      if (!data.success) return;
      const active = (data.contracts as { status: string; contractCode: string; tenantName: string; roomRental: number; room: { roomCode: string } }[])
        .filter((c) => c.status === "ACTIVE")
        .map((c) => ({
          contractCode: c.contractCode,
          roomCode: c.room.roomCode,
          tenantName: c.tenantName,
          roomRental: Number(c.roomRental),
        }))
        .sort((a, b) => a.roomCode.localeCompare(b.roomCode));
      setContracts(active);
    })();
  }, []);

  function selectContract(code: string) {
    setContractCode(code);
    const c = contracts.find((x) => x.contractCode === code);
    if (c) setAmount(String(c.roomRental));
  }

  async function submit() {
    if (!contractCode) {
      toast.warning(t("请先选房间", "Please select a room first"));
      return;
    }
    if (!amount || !dueDate) {
      toast.warning(t("金额和到期日一定要填", "Amount and due date are both required"));
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/contracts/${contractCode}/bills`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "RENTAL", amountDue: amount, dueDate, periodMonth }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setContractCode("");
        setAmount("");
        setDueDate("");
        setPeriodMonth("");
      } else {
        toast.danger(data.message);
      }
    } catch {
      toast.danger(t("系统出错，请稍后再试", "System error — please try again later"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-xl bg-white p-5 shadow-sm">
      <h3 className="mb-1 text-base font-semibold text-brand">
        {t("🏠 手动开房租账单", "🏠 Open a Rental Bill")}
      </h3>
      <p className="mb-3.5 text-xs text-gray-400">
        {t(
          "挑一个房间，自己打金额和到期日开一笔房租账单 — 适合自动生成漏掉的月份 (例如租客刚验证)，不受限于「下个月5号」的默认规则。",
          "Pick a room and type the amount/due date yourself to open a rental bill — for months the automatic cycle missed (e.g. a tenant who just got verified), without being limited to the \"5th of next month\" default."
        )}
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] flex-1">
          <label className="mb-1.5 block text-sm text-gray-600">{t("房间", "Room")}</label>
          <select value={contractCode} onChange={(e) => selectContract(e.target.value)} className="input">
            <option value="">{t("-- 选房间 --", "-- Select Room --")}</option>
            {contracts.map((c) => (
              <option key={c.contractCode} value={c.contractCode}>
                {c.roomCode} · {c.tenantName}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[110px] flex-1">
          <label className="mb-1.5 block text-sm text-gray-600">{t("金额 RM", "Amount RM")}</label>
          <input type="number" className="input" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="min-w-[130px] flex-1">
          <label className="mb-1.5 block text-sm text-gray-600">{t("到期日", "Due Date")}</label>
          <input type="date" className="input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
        <div className="min-w-[110px] flex-1">
          <label className="mb-1.5 block text-sm text-gray-600">{t("月份 (选填)", "Month (optional)")}</label>
          <input type="month" className="input" value={periodMonth} onChange={(e) => setPeriodMonth(e.target.value)} />
        </div>
        <button onClick={submit} disabled={submitting} className="btn-primary">
          {submitting ? t("开账单中...", "Creating...") : t("开账单", "Create Bill")}
        </button>
      </div>
    </div>
  );
}
