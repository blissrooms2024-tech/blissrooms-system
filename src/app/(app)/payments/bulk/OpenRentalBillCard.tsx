"use client";

import { useEffect, useState, useCallback } from "react";
import { useToast } from "@/components/Toast";
import { useLanguage } from "@/components/LanguageProvider";

type BillType = "RENTAL" | "CARPARK";

interface ActiveContract {
  contractCode: string;
  roomCode: string;
  tenantName: string;
  roomRental: number;
  carparkRental: number;
}

interface Gap {
  contractCode: string;
  roomCode: string;
  tenantName: string;
  billType: BillType;
  amount: number;
}

/** Manual one-off rental/carpark bill for a single room/contract — for cases the automatic
 * monthly cycle doesn't cover, e.g. a tenant who was unverified when the cron ran and needs
 * a bill backfilled for a specific (possibly past) month once they're verified. Admin picks
 * the room and bill type, types the amount and due date themselves rather than relying on
 * the contract's own roomRental/carparkRental and the next-5th default the monthly job
 * always uses.
 *
 * The room picker and the "still missing a bill" list both leave out any contract already
 * past its expiry date — it's still technically ACTIVE until someone formally renews/
 * terminates/moves it out, but opening a fresh bill (and emailing the tenant about it) for
 * someone whose lease has already ended would just cause confusion. */
export default function OpenRentalBillCard() {
  const toast = useToast();
  const { t } = useLanguage();
  const [contracts, setContracts] = useState<ActiveContract[]>([]);
  const [gaps, setGaps] = useState<Gap[] | null>(null);
  const [targetMonth, setTargetMonth] = useState("");
  const [contractCode, setContractCode] = useState("");
  const [billType, setBillType] = useState<BillType>("RENTAL");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [periodMonth, setPeriodMonth] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadContracts = useCallback(async () => {
    const res = await fetch("/api/contracts/page-data");
    const data = await res.json();
    if (!data.success) return;
    const today = new Date().toISOString().slice(0, 10);
    const active = (
      data.contracts as {
        status: string;
        contractCode: string;
        tenantName: string;
        roomRental: number;
        carparkRental: number;
        expiredDate: string | null;
        room: { roomCode: string };
      }[]
    )
      .filter((c) => c.status === "ACTIVE" && (!c.expiredDate || c.expiredDate.slice(0, 10) >= today))
      .map((c) => ({
        contractCode: c.contractCode,
        roomCode: c.room.roomCode,
        tenantName: c.tenantName,
        roomRental: Number(c.roomRental),
        carparkRental: Number(c.carparkRental),
      }))
      .sort((a, b) => a.roomCode.localeCompare(b.roomCode));
    setContracts(active);
  }, []);

  const loadGaps = useCallback(async () => {
    const res = await fetch("/api/contracts/rental-bill-gaps");
    const data = await res.json();
    if (!data.success) return;
    setGaps(data.gaps);
    setTargetMonth(data.targetMonth);
  }, []);

  useEffect(() => {
    // setState happens after each load's await, not synchronously in the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadContracts();
    loadGaps();
  }, [loadContracts, loadGaps]);

  function selectContract(code: string) {
    setContractCode(code);
    const c = contracts.find((x) => x.contractCode === code);
    if (c) setAmount(String(billType === "CARPARK" ? c.carparkRental : c.roomRental));
  }

  function selectBillType(bt: BillType) {
    setBillType(bt);
    const c = contracts.find((x) => x.contractCode === contractCode);
    if (c) setAmount(String(bt === "CARPARK" ? c.carparkRental : c.roomRental));
  }

  function quickFill(g: Gap) {
    setContractCode(g.contractCode);
    setBillType(g.billType);
    setAmount(String(g.amount));
    setDueDate(`${targetMonth}-05`);
    setPeriodMonth(targetMonth);
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
        body: JSON.stringify({ type: billType, amountDue: amount, dueDate, periodMonth }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setContractCode("");
        setBillType("RENTAL");
        setAmount("");
        setDueDate("");
        setPeriodMonth("");
        loadGaps();
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
        {t("🏠 手动开房租 / 车位账单", "🏠 Open a Rental / Carpark Bill")}
      </h3>
      <p className="mb-3.5 text-xs text-gray-400">
        {t(
          "挑一个房间，自己打金额和到期日开一笔房租或车位账单 — 适合自动生成漏掉的月份 (例如租客刚验证)，不受限于「下个月5号」的默认规则。已经过期、还没续约/终止的合同不会出现在这里，避免开错单。",
          "Pick a room and type the amount/due date yourself to open a rental or carpark bill — for months the automatic cycle missed (e.g. a tenant who just got verified), without being limited to the \"5th of next month\" default. Contracts already past expiry (not yet renewed/terminated) are left out, so you don't accidentally bill the wrong tenant."
        )}
      </p>

      {gaps && gaps.length > 0 && (
        <div className="mb-3.5 rounded-lg bg-amber-50 p-3.5">
          <div className="mb-2 text-sm font-semibold text-amber-800">
            ⚠️{" "}
            {t(
              `以下 ${gaps.length} 笔还没有 ${targetMonth} 的账单`,
              `${gaps.length} bill(s) still missing for ${targetMonth}`
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {gaps.map((g) => (
              <button
                key={`${g.contractCode}-${g.billType}`}
                type="button"
                onClick={() => quickFill(g)}
                className="rounded-md bg-white px-2.5 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-300 hover:bg-amber-100"
                title={t("点一下带入下面的表单", "Click to fill the form below")}
              >
                {g.billType === "CARPARK" ? "🚗" : "🏠"} {g.roomCode} · {g.tenantName}
              </button>
            ))}
          </div>
        </div>
      )}

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
          <label className="mb-1.5 block text-sm text-gray-600">{t("项目", "Item")}</label>
          <select value={billType} onChange={(e) => selectBillType(e.target.value as BillType)} className="input">
            <option value="RENTAL">{t("房租", "Rental")}</option>
            <option value="CARPARK">{t("车位", "Carpark")}</option>
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
