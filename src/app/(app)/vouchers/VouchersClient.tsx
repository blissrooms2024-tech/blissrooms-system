"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Modal from "@/components/Modal";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { useLanguage } from "@/components/LanguageProvider";
import { fmtDate, fmtMoney as fmt } from "@/lib/format";

interface Voucher {
  id: string;
  voucherCode: string;
  contractCode: string;
  roomCode: string;
  tenantName: string;
  amount: number;
  reason: string;
  imageUrl: string | null;
  expiryDate: string;
  status: string;
  issuedBy: string;
  issuedAt: string;
  redeemedAt: string | null;
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function VouchersClient({ role }: { role: string }) {
  const { t } = useLanguage();
  const toast = useToast();
  const [vouchers, setVouchers] = useState<Voucher[] | null>(null);
  const [error, setError] = useState("");
  const [issuing, setIssuing] = useState(false);
  const [form, setForm] = useState({ contractCode: "", amount: "", reason: "", expiryDate: "" });
  const [image, setImage] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState<Voucher | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/vouchers");
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

  function statusOf(v: Voucher): { label: string; cls: string } {
    if (v.status === "REDEEMED") return { label: t("已兑换", "Redeemed"), cls: "bg-green-50 text-green-700" };
    if (v.status === "CANCELLED") return { label: t("已取消", "Cancelled"), cls: "bg-gray-100 text-gray-500" };
    if (new Date(v.expiryDate) < new Date()) return { label: t("已过期", "Expired"), cls: "bg-red-50 text-red-700" };
    return { label: t("待兑换", "Unredeemed"), cls: "bg-amber-50 text-amber-700" };
  }

  async function submitIssue() {
    if (!form.contractCode.trim()) {
      toast.warning(t("请填合同号", "Please enter a contract code"));
      return;
    }
    if (!form.amount || Number(form.amount) <= 0) {
      toast.warning(t("请填金额", "Please enter an amount"));
      return;
    }
    if (!form.reason.trim()) {
      toast.warning(t("请填发放原因", "Please enter a reason"));
      return;
    }
    if (!form.expiryDate) {
      toast.warning(t("请选截至日期", "Please select an expiry date"));
      return;
    }
    if (image && image.size > 3 * 1024 * 1024) {
      toast.warning(t("图片太大(超过3MB)，请压缩", "Image too large (over 3MB) — please compress it"));
      return;
    }
    setSaving(true);
    try {
      const imageDataUrl = image ? await readAsDataURL(image) : undefined;
      const res = await fetch("/api/vouchers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractCode: form.contractCode.trim().toUpperCase(),
          amount: Number(form.amount),
          reason: form.reason.trim(),
          expiryDate: form.expiryDate,
          imageDataUrl,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setIssuing(false);
        setForm({ contractCode: "", amount: "", reason: "", expiryDate: "" });
        setImage(null);
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

  async function confirmCancel() {
    if (!cancelling) return;
    try {
      const res = await fetch(`/api/vouchers/${cancelling.id}/cancel`, { method: "POST" });
      const data = await res.json();
      if (data.success) toast.success(data.message);
      else toast.danger(data.message);
      setCancelling(null);
      load();
    } catch {
      toast.danger(t("网络连接失败，请检查网络后重试", "Network connection failed — please check your connection and try again"));
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white p-5 shadow-sm">
        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2.5">
          <h3 className="text-base font-semibold text-brand">🎟️ {t("代金券", "Vouchers")}</h3>
          {role === "ADMIN" && (
            <button onClick={() => setIssuing(true)} className="btn-primary text-sm">
              ➕ {t("发放代金券", "Issue Voucher")}
            </button>
          )}
        </div>
        <p className="mb-3.5 text-sm text-gray-500">
          {t(
            "公司给租客的奖励/补偿，有截至日期；租客自己在「我的代金券」兑换，兑换时效果跟现金一样 (自动抵账单)，同时会记一笔支出 (楼盘财务报表看得到)。过期没兑换的不会产生任何支出。",
            "A company reward/compensation for a tenant, with its own expiry date. The tenant redeems it themselves from \"My Vouchers\" — redemption spends exactly like cash (automatically settles bills) and books a matching Expense (visible on that property's finance report). One that expires unredeemed never costs anything."
          )}
        </p>

        {error && <div className="text-sm text-red-600">{error}</div>}
        {!vouchers && !error && <div className="text-sm text-gray-500">{t("载入中...", "Loading...")}</div>}
        {vouchers && vouchers.length === 0 && (
          <div className="py-6 text-center text-sm text-gray-400">{t("还没有发放过代金券", "No vouchers issued yet")}</div>
        )}
        {vouchers && vouchers.length > 0 && (
          <div className="max-h-[65vh] overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-gray-600">
                  <Th className="sticky left-0 top-0 z-20 bg-gray-50">{t("代金券号", "Voucher #")}</Th>
                  <Th className="sticky top-0 z-10 bg-gray-50">{t("合同/房间", "Contract/Room")}</Th>
                  <Th className="sticky top-0 z-10 bg-gray-50">{t("租客", "Tenant")}</Th>
                  <Th className="sticky top-0 z-10 bg-gray-50">{t("金额", "Amount")}</Th>
                  <Th className="sticky top-0 z-10 bg-gray-50">{t("原因", "Reason")}</Th>
                  <Th className="sticky top-0 z-10 bg-gray-50">{t("截至日期", "Expiry")}</Th>
                  <Th className="sticky top-0 z-10 bg-gray-50">{t("状态", "Status")}</Th>
                  <Th className="sticky top-0 z-10 bg-gray-50">{t("发放人", "Issued By")}</Th>
                  {role === "ADMIN" && <Th className="sticky top-0 z-10 bg-gray-50">{t("操作", "Actions")}</Th>}
                </tr>
              </thead>
              <tbody>
                {vouchers.map((v) => {
                  const badge = statusOf(v);
                  return (
                    <tr key={v.id} className="border-b border-gray-100 align-top">
                      <Td className="sticky left-0 z-[1] bg-white font-semibold">{v.voucherCode}</Td>
                      <Td>
                        <Link href={`/contracts/${v.contractCode}`} className="text-brand hover:underline">
                          {v.contractCode}
                        </Link>
                        <div className="text-xs text-gray-400">{v.roomCode}</div>
                      </Td>
                      <Td>{v.tenantName}</Td>
                      <Td className="font-semibold">{fmt(v.amount)}</Td>
                      <Td className="max-w-[160px] whitespace-normal">{v.reason}</Td>
                      <Td>{fmtDate(v.expiryDate)}</Td>
                      <Td>
                        <span className={`rounded-full px-2 py-0.5 text-xs ${badge.cls}`}>{badge.label}</span>
                      </Td>
                      <Td>{v.issuedBy}</Td>
                      {role === "ADMIN" && (
                        <Td>
                          {v.status === "ISSUED" && new Date(v.expiryDate) >= new Date() && (
                            <button
                              onClick={() => setCancelling(v)}
                              className="rounded-md bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-200"
                            >
                              🗑️ {t("取消", "Cancel")}
                            </button>
                          )}
                        </Td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {issuing && (
        <Modal onClose={() => setIssuing(false)}>
          <h3 className="mb-3.5 text-lg font-bold text-brand">🎟️ {t("发放代金券", "Issue Voucher")}</h3>
          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-sm text-gray-600">{t("合同号", "Contract Code")}</label>
              <input
                className="input"
                placeholder="CT-0001"
                value={form.contractCode}
                onChange={(e) => setForm({ ...form, contractCode: e.target.value })}
              />
            </div>
            <div className="flex gap-2.5">
              <div className="flex-1">
                <label className="mb-1.5 block text-sm text-gray-600">{t("金额 RM", "Amount RM")}</label>
                <input
                  type="number"
                  className="input"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </div>
              <div className="flex-1">
                <label className="mb-1.5 block text-sm text-gray-600">{t("截至日期", "Expiry Date")}</label>
                <input
                  type="date"
                  className="input"
                  value={form.expiryDate}
                  onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-gray-600">{t("发放原因", "Reason")}</label>
              <input
                className="input"
                placeholder={t("例: 推荐新租客奖励 / 维修不便补偿", "e.g. Referral reward / Compensation for inconvenience")}
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-gray-600">{t("图片 (选填)", "Image (optional)")}</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setImage(e.target.files?.[0] ?? null)}
                className="block w-full text-xs text-gray-500 file:mr-2 file:cursor-pointer file:rounded-lg file:border-0 file:bg-brand file:px-2.5 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-brand-dark"
              />
              {image && <div className="mt-1 text-xs text-gray-500">{t("已选择", "Selected")}: {image.name}</div>}
            </div>
            <button onClick={submitIssue} disabled={saving} className="btn-primary w-full">
              {saving ? t("处理中...", "Processing...") : t("确定发放", "Confirm Issue")}
            </button>
          </div>
        </Modal>
      )}

      <ConfirmDialog
        open={!!cancelling}
        danger
        title={t("取消代金券", "Cancel Voucher")}
        message={t(
          `确定要取消这张代金券 (${cancelling?.voucherCode}, RM${cancelling?.amount.toFixed(2)}) 吗？取消后租客不能再兑换。`,
          `Cancel this voucher (${cancelling?.voucherCode}, RM${cancelling?.amount.toFixed(2)})? The tenant won't be able to redeem it afterward.`
        )}
        confirmLabel={t("确定取消", "Confirm Cancel")}
        onConfirm={confirmCancel}
        onCancel={() => setCancelling(null)}
      />
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-2.5 py-1.5 font-semibold ${className}`}>{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-2.5 py-1.5 ${className}`}>{children}</td>;
}
