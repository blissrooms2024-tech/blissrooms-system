"use client";

import { useEffect, useState, useCallback } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { useLanguage } from "@/components/LanguageProvider";
import { fmtDate, fmtMoney as fmt } from "@/lib/format";
import { voucherGradient } from "@/lib/voucherTemplates";

interface Voucher {
  id: string;
  voucherCode: string;
  contractCode: string;
  roomCode: string;
  amount: number;
  reason: string;
  imageUrl: string | null;
  template: string;
  expiryDate: string;
  status: string;
  issuedAt: string;
  redeemedAt: string | null;
}

export default function MyVouchersClient() {
  const { t } = useLanguage();
  const toast = useToast();
  const [vouchers, setVouchers] = useState<Voucher[] | null>(null);
  const [error, setError] = useState("");
  const [redeeming, setRedeeming] = useState<Voucher | null>(null);
  const [redeemSaving, setRedeemSaving] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/my-vouchers");
      const data = await res.json();
      if (!data.success) {
        setError(data.message);
        return;
      }
      setVouchers(data.vouchers);
    } catch {
      setError(t("网络连接失败，请检查网络后重试", "Network connection failed — please check your connection and try again"));
    }
  }, [t]);

  useEffect(() => {
    // setState happens after the fetch's await, not synchronously in the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function confirmRedeem() {
    if (!redeeming) return;
    setRedeemSaving(true);
    try {
      const res = await fetch(`/api/vouchers/${redeeming.id}/redeem`, { method: "POST" });
      const data = await res.json();
      if (data.success) toast.success(data.message);
      else toast.danger(data.message);
      setRedeeming(null);
      load();
    } catch {
      toast.danger(t("网络连接失败，请检查网络后重试", "Network connection failed — please check your connection and try again"));
    } finally {
      setRedeemSaving(false);
    }
  }

  const now = new Date();
  const active = vouchers?.filter((v) => v.status === "ISSUED" && new Date(v.expiryDate) >= now) ?? [];
  const inactive = vouchers?.filter((v) => !(v.status === "ISSUED" && new Date(v.expiryDate) >= now)) ?? [];

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white p-4 sm:p-5 shadow-sm">
        <h3 className="mb-1 text-base font-semibold text-brand">🎟️ {t("我的代金券", "My Vouchers")}</h3>
        <p className="mb-4 text-sm text-gray-500">
          {t(
            "公司给你的奖励/补偿，可以兑换抵扣账单 (效果跟现金一样)，截至日期前没兑换就会过期失效。",
            "A reward or compensation from the company — redeem it to settle a bill (works exactly like cash). It expires if not redeemed before its expiry date."
          )}
        </p>

        {error && <div className="text-sm text-red-600">{error}</div>}
        {!vouchers && !error && <div className="text-sm text-gray-500">{t("载入中...", "Loading...")}</div>}
        {vouchers && vouchers.length === 0 && (
          <div className="py-8 text-center text-sm text-gray-400">{t("暂时还没有代金券", "No vouchers yet")}</div>
        )}

        {active.length > 0 && (
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {active.map((v) => {
              const daysLeft = Math.ceil((new Date(v.expiryDate).getTime() - now.getTime()) / (24 * 3600 * 1000));
              return (
                <div key={v.id} className="overflow-hidden rounded-xl border border-gray-200 shadow-sm">
                  <div
                    className={`relative flex h-28 items-center justify-center bg-gradient-to-br p-4 text-white ${
                      !v.imageUrl ? voucherGradient(v.template) : ""
                    }`}
                    style={v.imageUrl ? { backgroundImage: `url(${v.imageUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
                  >
                    {!v.imageUrl && <div className="text-3xl font-extrabold drop-shadow">{fmt(v.amount)}</div>}
                    {v.imageUrl && (
                      <div className="absolute bottom-1.5 right-2 rounded-full bg-black/50 px-2 py-0.5 text-sm font-bold">
                        {fmt(v.amount)}
                      </div>
                    )}
                  </div>
                  <div className="p-3.5">
                    <div className="text-sm font-semibold text-gray-800">{v.reason}</div>
                    <div className="mt-1 text-xs text-gray-500">
                      {t("截至", "Expires")}: {fmtDate(v.expiryDate)}{" "}
                      <span className={daysLeft <= 7 ? "font-semibold text-red-600" : ""}>
                        ({t(`还剩 ${daysLeft} 天`, `${daysLeft} day(s) left`)})
                      </span>
                    </div>
                    <button onClick={() => setRedeeming(v)} className="btn-primary mt-2.5 w-full text-sm">
                      🎁 {t("立即兑换", "Redeem Now")}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {inactive.length > 0 && (
          <>
            <div className="mb-2 mt-5 text-sm font-semibold text-gray-500">{t("已失效 / 已兑换", "Used / Expired")}</div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {inactive.map((v) => {
                const expired = v.status === "ISSUED" && new Date(v.expiryDate) < now;
                return (
                  <div key={v.id} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 p-3 opacity-70">
                    <div>
                      <div className="text-sm font-semibold text-gray-600">
                        {fmt(v.amount)} — {v.reason}
                      </div>
                      <div className="text-xs text-gray-400">{t("截至", "Expires")}: {fmtDate(v.expiryDate)}</div>
                    </div>
                    <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-600">
                      {v.status === "REDEEMED"
                        ? t("已兑换", "Redeemed")
                        : v.status === "CANCELLED"
                          ? t("已取消", "Cancelled")
                          : expired
                            ? t("已过期", "Expired")
                            : v.status}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <ConfirmDialog
        open={!!redeeming}
        title={t("兑换代金券", "Redeem Voucher")}
        message={t(
          `确定兑换这张 ${redeeming ? fmt(redeeming.amount) : ""} 的代金券吗？会自动抵扣你的账单，不能撤销。`,
          `Redeem this ${redeeming ? fmt(redeeming.amount) : ""} voucher? It will automatically settle your bills — this can't be undone.`
        )}
        confirmLabel={redeemSaving ? t("处理中...", "Processing...") : t("确定兑换", "Confirm Redeem")}
        onConfirm={confirmRedeem}
        onCancel={() => setRedeeming(null)}
      />
    </div>
  );
}
