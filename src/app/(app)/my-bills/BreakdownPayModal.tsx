"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { PAYMENT_TYPE_LABELS } from "@/lib/config";

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function BreakdownPayModal({
  contractCode,
  item,
  outstanding,
  onClose,
  onPaid,
}: {
  contractCode: string;
  item: string;
  outstanding: number;
  onClose: () => void;
  onPaid: () => void;
}) {
  const toast = useToast();
  const [amount, setAmount] = useState(String(outstanding));
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      toast.warning("请填正确的金额");
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
      const res = await fetch(`/api/contracts/${contractCode}/breakdown-pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item, amount: amt, dataUrl }),
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
      <h3 className="mb-1 text-lg font-bold text-brand">
        💰 付款 — {PAYMENT_TYPE_LABELS[item] ?? item}
      </h3>
      <p className="mb-3.5 text-sm text-gray-500">
        还欠 RM{outstanding.toLocaleString()}。Admin 还没为这个项目开账单，请先转账后在下面上传付款证明。
      </p>
      <div className="space-y-3">
        <div>
          <label className="mb-1.5 block text-sm text-gray-600">金额 RM</label>
          <input
            type="number"
            min="1"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="input"
          />
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
