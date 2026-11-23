"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useToast } from "@/components/Toast";
import { useT } from "@/components/LanguageProvider";
import ConfirmDialog from "@/components/ConfirmDialog";
import { fmtDate } from "@/lib/format";
import { FEES } from "@/lib/config";

interface Candidate {
  contractCode: string;
  tenantName: string;
  roomCode: string;
  agentName: string;
  contactNumber: string | null;
  expiredDate: string | null;
  daysToExpiry: number | null;
  renewalRequestedAt: string | null;
  renewalRequestedMonths: number | null;
  roomRental: number;
  carparkRental: number;
  securityDeposit: number;
  utilitiesDeposit: number;
  accessCardDeposit: number;
}

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

// Best-effort local-to-international normalization for a Malaysian mobile number, matching
// the same logic used server-side when the renewal-request email builds its wa.me link.
function toWhatsAppLink(phone: string | null, tenantName: string) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  const intl = digits.startsWith("0") ? "60" + digits.slice(1) : digits;
  const text = encodeURIComponent(`Hi ${tenantName}, this is Bliss Rooms regarding your tenancy renewal. `);
  return `https://wa.me/${intl}?text=${text}`;
}

export default function RenewalClient() {
  const toast = useToast();
  const t = useT();
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [commencementDate, setCommencementDate] = useState("");
  const [newDate, setNewDate] = useState("");
  const [roomRental, setRoomRental] = useState("");
  const [carparkRental, setCarparkRental] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [movingOut, setMovingOut] = useState<Candidate | null>(null);
  const [movingOutSaving, setMovingOutSaving] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/contracts/renewal-candidates");
      const data = await res.json();
      if (!data.success) {
        setError(data.message);
        return;
      }
      setCandidates(data.contracts);
    } catch {
      setError(t("出错，请稍后再试", "Something went wrong — please try again later"));
    }
  }, [t]);

  useEffect(() => {
    // setState happens after the fetch's await, not synchronously in the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  function openRow(c: Candidate) {
    setOpenId(c.contractCode);
    setCommencementDate(addDays(c.expiredDate, 1));
    setNewDate(addMonths(c.expiredDate, c.renewalRequestedMonths ?? 12));
    setRoomRental(String(c.roomRental));
    setCarparkRental(String(c.carparkRental));
  }

  async function confirmRenew() {
    if (!openId) return;
    setConfirming(false);
    setSaving(true);
    try {
      const res = await fetch(`/api/contracts/${openId}/renew`, {
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
        setOpenId(null);
        load();
      } else {
        toast.danger(data.message);
      }
    } catch {
      toast.danger(t("系统出错，请稍后再试", "System error — please try again later"));
    } finally {
      setSaving(false);
    }
  }

  async function confirmMoveOut() {
    if (!movingOut) return;
    setMovingOutSaving(true);
    try {
      const res = await fetch(`/api/contracts/${movingOut.contractCode}/move-out`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setMovingOut(null);
        load();
      } else {
        toast.danger(data.message);
      }
    } catch {
      toast.danger(t("系统出错，请稍后再试", "System error — please try again later"));
    } finally {
      setMovingOutSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="rounded-xl bg-white p-5 shadow-sm">
        <div className="mb-3.5 flex items-center justify-between">
          <h3 className="text-base font-semibold text-brand">🔄 {t("续约管理", "Renewals")}</h3>
          <Link href="/contracts" className="text-sm text-gray-500 hover:underline">
            ← {t("返回合同清单", "Back to Contracts")}
          </Link>
        </div>
        <div className="mb-3.5 rounded-lg bg-brand-light/40 p-3.5 text-sm text-gray-600">
          {t(
            `这里列出快到期 (提前 2 个月内) 或已经到期的生效中合同。租客要续约的话请他们直接联系 Admin，确认后在这里帮他们开一份新合同 (可以改房租等细节)，系统会开一笔 RM${FEES.RENEWAL.toFixed(2)} 续约行政费账单，押金直接带过去不用重新交，Agent 和租客要重新签名新合同才会生效。`,
            `This lists active contracts that are expiring soon (within 2 months) or have already expired. If a tenant wants to renew, have them contact Admin directly — once confirmed, open a fresh contract here (you can adjust the rent and other details). The system creates a RM${FEES.RENEWAL.toFixed(2)} renewal admin fee bill, deposits carry over without being re-collected, and the Agent and tenant both need to sign the new contract before it takes effect.`
          )}
        </div>

        {error && <div className="text-sm text-red-600">{error}</div>}
        {!candidates && !error && <div className="text-sm text-gray-500">{t("载入中...", "Loading...")}</div>}
        {candidates && candidates.length === 0 && (
          <div className="py-6 text-center text-sm text-gray-400">{t("目前没有快到期或已到期的合同", "No contracts expiring soon or already expired")}</div>
        )}

        {candidates && candidates.length > 0 && (
          <div className="mb-2 text-xs text-gray-500">{t(`共 ${candidates.length} 份合同`, `${candidates.length} contracts total`)}</div>
        )}
        {candidates && candidates.length > 0 && (
          <div className="space-y-2.5">
            {candidates.map((c) => (
              <div key={c.contractCode} className="rounded-lg border border-gray-200 p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <div>
                    <Link href={`/contracts/${c.contractCode}`} className="font-semibold text-brand hover:underline">
                      {c.contractCode}
                    </Link>{" "}
                    · {c.tenantName} · {c.roomCode} · {c.agentName}
                    <div className="text-xs text-gray-500">
                      {t("到期日", "Expiry Date")}: {fmtDate(c.expiredDate)}{" "}
                      {c.daysToExpiry !== null && c.daysToExpiry < 0 ? (
                        <span className="font-semibold text-red-600">
                          ({t(`已过期 ${Math.abs(c.daysToExpiry)} 天`, `${Math.abs(c.daysToExpiry)} days overdue`)})
                        </span>
                      ) : (
                        <span className="font-semibold text-amber-600">
                          ({t(`还剩 ${c.daysToExpiry} 天`, `${c.daysToExpiry} days left`)})
                        </span>
                      )}
                    </div>
                    {c.renewalRequestedAt && (
                      <div className="mt-1 inline-block rounded-full bg-violet-50 px-2 py-0.5 text-xs font-semibold text-violet-700">
                        🔄{" "}
                        {t(
                          `租客已申请续约 ${c.renewalRequestedMonths} 个月 (${fmtDate(c.renewalRequestedAt)})`,
                          `Tenant requested a ${c.renewalRequestedMonths}-month renewal (${fmtDate(c.renewalRequestedAt)})`
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {toWhatsAppLink(c.contactNumber, c.tenantName) && (
                      <a
                        href={toWhatsAppLink(c.contactNumber, c.tenantName)!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-soft text-sm"
                      >
                        📱 WhatsApp
                      </a>
                    )}
                    {openId !== c.contractCode && (
                      <button onClick={() => openRow(c)} className="btn-primary text-sm">
                        🔄 {t("续约 (开新合同)", "Renew (New Contract)")}
                      </button>
                    )}
                    <button
                      onClick={() => setMovingOut(c)}
                      className="rounded-lg bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-100"
                    >
                      🚪 {t("搬出", "Move Out")}
                    </button>
                  </div>
                </div>

                {openId === c.contractCode && (
                  <div className="mt-3 space-y-2.5 border-t border-gray-100 pt-3">
                    <div className="flex flex-wrap items-end gap-2.5">
                      <div>
                        <label className="mb-1.5 block text-sm text-gray-600">{t("新合同生效日期", "New Contract Start Date")}</label>
                        <input
                          type="date"
                          value={commencementDate}
                          onChange={(e) => setCommencementDate(e.target.value)}
                          className="input"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm text-gray-600">{t("新到期日", "New Expiry Date")}</label>
                        <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="input" />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm text-gray-600">{t("新房租 RM", "New Rent RM")}</label>
                        <input
                          type="number"
                          step="1"
                          value={roomRental}
                          onChange={(e) => setRoomRental(e.target.value)}
                          className="input w-[110px]"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm text-gray-600">{t("新车位租金 RM", "New Carpark RM")}</label>
                        <input
                          type="number"
                          step="1"
                          value={carparkRental}
                          onChange={(e) => setCarparkRental(e.target.value)}
                          className="input w-[110px]"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-gray-500">
                      {t(
                        `押金会直接带过去 (押金 RM${c.securityDeposit.toFixed(2)} / 水电押 RM${c.utilitiesDeposit.toFixed(2)} / 门卡押 RM${c.accessCardDeposit.toFixed(2)})，不用租客重新交。`,
                        `Deposits carry over as-is (Security RM${c.securityDeposit.toFixed(2)} / Utilities RM${c.utilitiesDeposit.toFixed(2)} / Access Card RM${c.accessCardDeposit.toFixed(2)}) — the tenant doesn't pay them again.`
                      )}
                    </p>
                    <div className="flex flex-wrap gap-2.5">
                      <button onClick={() => setConfirming(true)} disabled={saving} className="btn-primary text-sm">
                        {saving
                          ? t("处理中...", "Processing...")
                          : t(`确认, 开新合同 (开 RM${FEES.RENEWAL.toFixed(2)} 行政费)`, `Confirm — Create New Contract (creates a RM${FEES.RENEWAL.toFixed(2)} admin fee bill)`)}
                      </button>
                      <button onClick={() => setOpenId(null)} className="btn-soft text-sm">
                        {t("取消", "Cancel")}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirming}
        message={t(
          `确定帮 ${openId} 开一份新合同吗？新合同期限 ${commencementDate} ~ ${newDate}，房租 RM${roomRental}。旧合同会在新合同双方签完名后自动结束，押金带过去，并开一笔 RM${FEES.RENEWAL.toFixed(2)} 续约行政费账单给租客。`,
          `Create a new contract for ${openId}? The new term runs ${commencementDate} ~ ${newDate} at RM${roomRental}/month. The old contract will close automatically once both the Agent and tenant sign the new one; deposits carry over, and a RM${FEES.RENEWAL.toFixed(2)} renewal admin fee bill will be created for the tenant.`
        )}
        confirmLabel={t("确定, 开新合同", "Confirm — Create New Contract")}
        onConfirm={confirmRenew}
        onCancel={() => setConfirming(false)}
      />

      <ConfirmDialog
        open={!!movingOut}
        danger
        message={t(
          `确定 ${movingOut?.tenantName} (${movingOut?.contractCode}) 已经搬出吗？这会把合同标记为已搬出，房间 ${movingOut?.roomCode} 马上变回空房，可以租给新租客。`,
          `Confirm ${movingOut?.tenantName} (${movingOut?.contractCode}) has moved out? This marks the contract as moved out and immediately frees up room ${movingOut?.roomCode} for a new tenant.`
        )}
        confirmLabel={movingOutSaving ? t("处理中...", "Processing...") : t("确定搬出", "Confirm Move Out")}
        onConfirm={confirmMoveOut}
        onCancel={() => setMovingOut(null)}
      />
    </div>
  );
}
