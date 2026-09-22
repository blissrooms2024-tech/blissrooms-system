"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { useLanguage } from "@/components/LanguageProvider";
import { paymentTypeLabelLocale } from "@/lib/config";

interface Item {
  item: string;
  outstanding: number;
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function BreakdownPayAllModal({
  contractCode,
  items,
  total,
  onClose,
  onPaid,
}: {
  contractCode: string;
  items: Item[];
  total: number;
  onClose: () => void;
  onPaid: () => void;
}) {
  const toast = useToast();
  const { locale, t } = useLanguage();
  const [amount, setAmount] = useState(String(total));
  const [paidDate, setPaidDate] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState("Bank Transfer");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const amt = Number(amount);
  const isPartial = amt > 0 && amt < total;

  async function submit() {
    if (total <= 0) {
      toast.warning(t("目前没有可以支付的项目", "There's nothing payable right now"));
      return;
    }
    if (!amt || amt <= 0) {
      toast.warning(t("请填正确的金额", "Please enter a valid amount"));
      return;
    }
    if (amt > total) {
      toast.warning(
        t(`金额不能超过还欠总额 RM${total.toLocaleString()}`, `Amount can't exceed the total outstanding of RM${total.toLocaleString()}`)
      );
      return;
    }
    if (!file) {
      toast.warning(t("请上传付款证明", "Please upload proof of payment"));
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      toast.warning(t("图片太大(超过3MB)，请压缩", "Image too large (over 3MB) — please compress it"));
      return;
    }
    setSubmitting(true);
    try {
      const dataUrl = await readAsDataURL(file);
      const res = await fetch(`/api/contracts/${contractCode}/breakdown-pay-all`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amt, dataUrl, paidDate, method }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        onPaid();
        onClose();
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
    <Modal onClose={onClose}>
      <h3 className="mb-1 text-lg font-bold text-brand">
        {t("💰 一次过付款", "💰 Pay All at Once")} — {contractCode}
      </h3>
      <p className="mb-3.5 text-sm text-gray-500">
        {t(
          "以下项目还没开账单，一次上传一张付款证明就够了，不用逐项分开付。",
          "These items haven't been billed yet — upload one proof of payment covering all of them, no need to pay each one separately."
        )}
      </p>

      {total > 0 ? (
        <div className="mb-3.5 space-y-1 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
          {items.map((it) => (
            <div key={it.item} className="flex items-center justify-between">
              <span className="text-gray-600">{paymentTypeLabelLocale(it.item, null, locale)}</span>
              <span className="font-semibold">RM{it.outstanding.toLocaleString()}</span>
            </div>
          ))}
          <div className="mt-1.5 flex items-center justify-between border-t border-gray-200 pt-1.5">
            <b>{t("还欠总额", "Total Outstanding")}</b>
            <b className="text-brand">RM{total.toLocaleString()}</b>
          </div>
        </div>
      ) : (
        <p className="mb-3.5 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-500">
          {t(
            "目前没有可以支付的项目（已全部付清，或已有账单在等 Admin 审核）。",
            "There's nothing payable right now (either fully settled, or a bill is already awaiting Admin review)."
          )}
        </p>
      )}

      <div className="space-y-3">
        <div>
          <label className="mb-1.5 block text-sm text-gray-600">{t("付款金额 RM", "Payment Amount RM")}</label>
          <input
            type="number"
            min="1"
            max={total || undefined}
            step="0.01"
            value={amount}
            disabled={total <= 0}
            onChange={(e) => setAmount(e.target.value)}
            className="input"
          />
          {isPartial && (
            <p className="mt-1 text-xs text-amber-600">
              {t(
                "⚠️ 这个金额没有付清全部，系统会按 押金→水电押→Admin Fee→门卡押→车位→房租 的顺序分配，付不完的项目会显示部分已收，还欠剩下的部分，之后可以再一次过补。",
                "⚠️ This amount doesn't cover everything — it'll be allocated in order (deposit → utilities deposit → admin fee → access card → carpark → rental); whichever item it runs out on stays partially paid, and you can top it up again later."
              )}
            </p>
          )}
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-gray-600">{t("付款日期", "Payment Date")}</label>
          <input type="date" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} disabled={total <= 0} className="input" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-gray-600">{t("付款方式", "Payment Method")}</label>
          <select value={method} onChange={(e) => setMethod(e.target.value)} disabled={total <= 0} className="input">
            <option>Bank Transfer</option>
            <option>Cash</option>
            <option>Cheque</option>
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-gray-600">{t("付款证明", "Proof of Payment")}</label>
          <input
            type="file"
            accept="image/*"
            disabled={submitting || total <= 0}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block text-sm text-gray-500 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-brand file:px-3.5 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-brand-dark disabled:opacity-50"
          />
          {file && <div className="mt-1.5 text-xs text-gray-500">{t("已选择", "Selected")}: {file.name}</div>}
        </div>
        <button onClick={submit} disabled={submitting || total <= 0} className="btn-primary w-full">
          {submitting ? t("提交中...", "Submitting...") : t("提交付款证明", "Submit Proof of Payment")}
        </button>
      </div>
    </Modal>
  );
}
