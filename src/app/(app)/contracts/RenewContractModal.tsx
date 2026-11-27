"use client";

import { useCallback, useEffect, useState } from "react";
import Modal from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { useT } from "@/components/LanguageProvider";
import ConfirmDialog from "@/components/ConfirmDialog";
import { FEES } from "@/lib/config";

function addDays(dateStr: string | null, days: number) {
  const d = dateStr ? new Date(dateStr) : new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function addMonths(dateStr: string | null, months: number) {
  const d = dateStr ? new Date(dateStr) : new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

/** Same renew flow as the dedicated 续约管理 page (and the same /renew endpoint), just reachable
 * straight from a single contract's own Actions instead of having to go find it again in that
 * page's full list of candidates — added because Admin sometimes forgets a contract needs
 * renewing until they're already looking at it. */
export default function RenewContractModal({
  contractCode,
  onClose,
  onRenewed,
}: {
  contractCode: string;
  onClose: () => void;
  onRenewed: () => void;
}) {
  const toast = useToast();
  const t = useT();
  const [loading, setLoading] = useState(true);
  const [notActive, setNotActive] = useState(false);
  const [deposits, setDeposits] = useState({ securityDeposit: 0, utilitiesDeposit: 0, accessCardDeposit: 0 });
  const [commencementDate, setCommencementDate] = useState("");
  const [newDate, setNewDate] = useState("");
  const [roomRental, setRoomRental] = useState("");
  const [carparkRental, setCarparkRental] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/contracts/${contractCode}`);
      const data = await res.json();
      if (!data.success) {
        toast.danger(data.message);
        onClose();
        return;
      }
      const c = data.contract;
      if (c.status !== "ACTIVE") {
        setNotActive(true);
        setLoading(false);
        return;
      }
      setDeposits({
        securityDeposit: Number(c.securityDeposit) || 0,
        utilitiesDeposit: Number(c.utilitiesDeposit) || 0,
        accessCardDeposit: Number(c.accessCardDeposit) || 0,
      });
      setCommencementDate(addDays(c.expiredDate, 1));
      setNewDate(addMonths(c.expiredDate, 12));
      setRoomRental(String(c.roomRental));
      setCarparkRental(String(c.carparkRental));
      setLoading(false);
    } catch {
      toast.danger(t("系统出错，请稍后再试", "System error — please try again later"));
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractCode]);

  useEffect(() => {
    // setState happens after the fetch's await, not synchronously in the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function confirmRenew() {
    setConfirming(false);
    setSaving(true);
    try {
      const res = await fetch(`/api/contracts/${contractCode}/renew`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commencementDate,
          newExpiredDate: newDate,
          roomRental: Number(roomRental) || 0,
          carparkRental: Number(carparkRental) || 0,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        onRenewed();
        onClose();
      } else {
        toast.danger(data.message);
      }
    } catch {
      toast.danger(t("系统出错，请稍后再试", "System error — please try again later"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <h3 className="mb-1 text-lg font-bold text-brand">
        🔄 {t("续约 (开新合同)", "Renew (New Contract)")} — {contractCode}
      </h3>

      {loading && <p className="py-4 text-center text-sm text-gray-400">{t("载入中...", "Loading...")}</p>}

      {!loading && notActive && (
        <p className="py-4 text-sm text-gray-500">
          {t("只能续约生效中的合同——这张合同目前不是生效中状态。", "Only an active contract can be renewed — this one isn't currently active.")}
        </p>
      )}

      {!loading && !notActive && (
        <>
          <p className="mb-3.5 text-sm text-gray-500">
            {t(
              `确认后会帮这张合同开一份新合同 (可以改房租等细节)，系统会开一笔 RM${FEES.RENEWAL.toFixed(2)} 续约行政费账单，押金直接带过去不用重新交，Agent 和租客要重新签名新合同才会生效。`,
              `Confirming opens a fresh contract (you can adjust the rent and other details). The system creates a RM${FEES.RENEWAL.toFixed(2)} renewal admin fee bill, deposits carry over without being re-collected, and the Agent and tenant both need to sign the new contract before it takes effect.`
            )}
          </p>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-3">
              <div>
                <label className="mb-1.5 block text-sm text-gray-600">{t("新合同生效日期", "New Contract Start Date")}</label>
                <input type="date" value={commencementDate} onChange={(e) => setCommencementDate(e.target.value)} className="input" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm text-gray-600">{t("新到期日", "New Expiry Date")}</label>
                <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="input" />
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <div>
                <label className="mb-1.5 block text-sm text-gray-600">{t("新房租 RM", "New Rent RM")}</label>
                <input type="number" step="1" value={roomRental} onChange={(e) => setRoomRental(e.target.value)} className="input w-[120px]" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm text-gray-600">{t("新车位租金 RM", "New Carpark RM")}</label>
                <input type="number" step="1" value={carparkRental} onChange={(e) => setCarparkRental(e.target.value)} className="input w-[120px]" />
              </div>
            </div>
            <p className="text-xs text-gray-500">
              {t(
                `押金会直接带过去 (押金 RM${deposits.securityDeposit.toFixed(2)} / 水电押 RM${deposits.utilitiesDeposit.toFixed(2)} / 门卡押 RM${deposits.accessCardDeposit.toFixed(2)})，不用租客重新交。`,
                `Deposits carry over as-is (Security RM${deposits.securityDeposit.toFixed(2)} / Utilities RM${deposits.utilitiesDeposit.toFixed(2)} / Access Card RM${deposits.accessCardDeposit.toFixed(2)}) — the tenant doesn't pay them again.`
              )}
            </p>
            <button onClick={() => setConfirming(true)} disabled={saving} className="btn-primary w-full">
              {saving
                ? t("处理中...", "Processing...")
                : t(`确认, 开新合同 (开 RM${FEES.RENEWAL.toFixed(2)} 行政费)`, `Confirm — Create New Contract (creates a RM${FEES.RENEWAL.toFixed(2)} admin fee bill)`)}
            </button>
          </div>
        </>
      )}

      <ConfirmDialog
        open={confirming}
        message={t(
          `确定帮 ${contractCode} 开一份新合同吗？新合同期限 ${commencementDate} ~ ${newDate}，房租 RM${roomRental}。旧合同会在新合同双方签完名后自动结束，押金带过去，并开一笔 RM${FEES.RENEWAL.toFixed(2)} 续约行政费账单给租客。`,
          `Create a new contract for ${contractCode}? The new term runs ${commencementDate} ~ ${newDate} at RM${roomRental}/month. The old contract will close automatically once both the Agent and tenant sign the new one; deposits carry over, and a RM${FEES.RENEWAL.toFixed(2)} renewal admin fee bill will be created for the tenant.`
        )}
        confirmLabel={t("确定, 开新合同", "Confirm — Create New Contract")}
        onConfirm={confirmRenew}
        onCancel={() => setConfirming(false)}
      />
    </Modal>
  );
}
