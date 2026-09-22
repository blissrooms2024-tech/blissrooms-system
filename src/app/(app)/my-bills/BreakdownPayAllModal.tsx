"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { PAYMENT_TYPE_LABELS } from "@/lib/config";

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
  const [amount, setAmount] = useState(String(total));
  const [paidDate, setPaidDate] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState("Bank Transfer");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const amt = Number(amount);
  const isPartial = amt > 0 && amt < total;

  async function submit() {
    if (!amt || amt <= 0) {
      toast.warning("请填正确的金额");
      return;
    }
    if (amt > total) {
      toast.warning(`金额不能超过还欠总额 RM${total.toLocaleString()}`);
      return;
    }
    if (!file) {
      toast.warning("请上传付款证明");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      toast.warning("图片太大(超过3MB)，请压缩");
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
      toast.danger("系统出错，请稍后再试");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <h3 className="mb-1 text-lg font-bold text-brand">💰 一次过付款 — {contractCode}</h3>
      <p className="mb-3.5 text-sm text-gray-500">
        以下项目还没开账单，一次上传一张付款证明就够了，不用逐项分开付。
      </p>

      <div className="mb-3.5 space-y-1 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
        {items.map((it) => (
          <div key={it.item} className="flex items-center justify-between">
            <span className="text-gray-600">{PAYMENT_TYPE_LABELS[it.item] ?? it.item}</span>
            <span className="font-semibold">RM{it.outstanding.toLocaleString()}</span>
          </div>
        ))}
        <div className="mt-1.5 flex items-center justify-between border-t border-gray-200 pt-1.5">
          <b>还欠总额</b>
          <b className="text-brand">RM{total.toLocaleString()}</b>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="mb-1.5 block text-sm text-gray-600">付款金额 RM</label>
          <input
            type="number"
            min="1"
            max={total}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="input"
          />
          {isPartial && (
            <p className="mt-1 text-xs text-amber-600">
              ⚠️ 这个金额没有付清全部，系统会按 押金→水电押→Admin Fee→门卡押→车位→房租 的顺序分配，付不完的项目会显示部分已收，还欠剩下的部分，之后可以再一次过补。
            </p>
          )}
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-gray-600">付款日期</label>
          <input type="date" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} className="input" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-gray-600">付款方式</label>
          <select value={method} onChange={(e) => setMethod(e.target.value)} className="input">
            <option>Bank Transfer</option>
            <option>Cash</option>
            <option>Cheque</option>
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-gray-600">付款证明</label>
          <input
            type="file"
            accept="image/*"
            disabled={submitting}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block text-sm text-gray-500 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-brand file:px-3.5 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-brand-dark disabled:opacity-50"
          />
          {file && <div className="mt-1.5 text-xs text-gray-500">已选择: {file.name}</div>}
        </div>
        <button onClick={submit} disabled={submitting} className="btn-primary w-full">
          {submitting ? "提交中..." : "提交付款证明"}
        </button>
      </div>
    </Modal>
  );
}
