"use client";

import { useEffect, useState, useCallback } from "react";
import Lightbox from "@/components/Lightbox";
import StepTimeline, { TimelineStep } from "@/components/StepTimeline";
import { useToast } from "@/components/Toast";
import { COMPANY } from "@/lib/config";

interface AcPayment {
  id: string;
  paymentCode: string;
  type: string;
  amountDue: number;
  amountPaid: number;
  status: string;
  paidDate: string | null;
  receiptLink: string | null;
  reviewNote: string | null;
}

function fmt(v: number) {
  return v || v === 0 ? `RM${Number(v).toLocaleString()}` : "-";
}
function fmtDate(v: string | null) {
  return v ? v.slice(0, 10) : "-";
}
function monthOf(v: string | null) {
  return v ? v.slice(0, 7) : "未知月份";
}
function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const AC_FLOW = ["PENDING", "PENDING_REVIEW", "Paid"];

function buildAcSteps(p: AcPayment): TimelineStep[] {
  if (p.status === "REJECTED") {
    return [
      { label: "已提交", state: "done" },
      { label: "已拒绝", sublabel: p.reviewNote ?? undefined, state: "rejected" },
    ];
  }
  const currentIndex = AC_FLOW.indexOf(p.status);
  return [
    {
      label: "已提交",
      sublabel: p.paidDate ? p.paidDate.slice(0, 10) : undefined,
      state: currentIndex >= 1 ? "done" : "active",
    },
    {
      label: "已充值",
      sublabel: currentIndex === 1 ? "Admin 会在12小时内(工作日)更新到 Smart Meter" : undefined,
      state: currentIndex === 2 ? "done" : "pending",
    },
  ];
}

export default function AcTopupPanel({ contractCode }: { contractCode: string }) {
  const toast = useToast();
  const [hasAircon, setHasAircon] = useState(false);
  const [payments, setPayments] = useState<AcPayment[]>([]);
  const [topupAmount, setTopupAmount] = useState("");
  const [topupFile, setTopupFile] = useState<File | null>(null);
  const [topupSubmitting, setTopupSubmitting] = useState(false);
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/contracts/${contractCode}/payments`);
    const data = await res.json();
    if (!data.success) {
      toast.danger(data.message);
      return;
    }
    setHasAircon(!!data.contract?.room?.hasAircon);
    setPayments((data.payments as AcPayment[]).filter((p) => p.type === "AC"));
  }, [contractCode, toast]);

  useEffect(() => {
    // setState happens after the fetch's await, not synchronously in the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function submitTopup() {
    const amount = Number(topupAmount);
    if (!amount || amount <= 0) {
      toast.warning("请填正确的充值金额");
      return;
    }
    if (!topupFile) {
      toast.warning("请上传转账证明");
      return;
    }
    if (topupFile.size > 3 * 1024 * 1024) {
      toast.warning("图片太大(超过3MB)，请压缩");
      return;
    }
    setTopupSubmitting(true);
    try {
      const dataUrl = await readAsDataURL(topupFile);
      const res = await fetch(`/api/contracts/${contractCode}/ac-topup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, dataUrl }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setTopupAmount("");
        setTopupFile(null);
        load();
      } else {
        toast.danger(data.message);
      }
    } catch {
      toast.danger("系统出错，请稍后再试");
    } finally {
      setTopupSubmitting(false);
    }
  }

  if (!hasAircon) {
    return (
      <div className="rounded-xl bg-white p-5 text-center text-sm text-gray-400 shadow-sm">
        这间房没有冷气，不需要冷气充值。
      </div>
    );
  }

  // Group by month so tenants can see roughly how much they've been topping up per month —
  // this system has no actual kWh usage data from the smart meter, only what's been paid in.
  const byMonth = new Map<string, AcPayment[]>();
  for (const p of payments) {
    const m = monthOf(p.paidDate);
    byMonth.set(m, [...(byMonth.get(m) ?? []), p]);
  }
  const months = [...byMonth.keys()].sort().reverse();

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white p-5 shadow-sm">
        <h3 className="text-lg font-bold text-brand">❄️ 冷气 Top-up 充值</h3>
        <div className="mt-3 rounded-lg bg-brand-light/40 p-3.5 text-sm">
          <div className="font-semibold text-brand">{COMPANY.NAME}</div>
          <div className="mt-1 text-gray-700">
            {COMPANY.BANK} · Acc No: <b>{COMPANY.ACC_NO}</b>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            请先把充值金额转入以上公司户口，然后在下面填写金额并上传转账证明。Admin
            会在收到后12小时内(工作日)更新到 Smart Meter。
          </p>
        </div>

        <div className="mt-3.5 flex flex-wrap items-center gap-2">
          <input
            type="number"
            min="1"
            step="0.01"
            placeholder="金额 RM"
            value={topupAmount}
            onChange={(e) => setTopupAmount(e.target.value)}
            className="input w-[130px]"
          />
          <input
            type="file"
            accept="image/*"
            disabled={topupSubmitting}
            onChange={(e) => setTopupFile(e.target.files?.[0] ?? null)}
            className="block text-sm text-gray-500 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-brand file:px-3.5 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-brand-dark disabled:opacity-50"
          />
          <button onClick={submitTopup} disabled={topupSubmitting} className="btn-primary">
            {topupSubmitting ? "提交中..." : "提交充值"}
          </button>
        </div>
        {topupFile && <div className="mt-1.5 text-xs text-gray-500">已选择: {topupFile.name}</div>}
      </div>

      <div className="rounded-xl bg-white p-5 shadow-sm">
        <h3 className="mb-1 text-base font-semibold text-brand">📅 每月充值记录</h3>
        <p className="mb-3 text-xs text-gray-400">系统没有 Smart Meter 实时用量数据，以下是每个月的充值金额记录</p>
        {months.length === 0 && (
          <div className="py-6 text-center text-sm text-gray-400">还没有充值记录</div>
        )}
        {months.map((m) => {
          const rows = byMonth.get(m)!;
          const monthTotal = rows.reduce((s, p) => s + Number(p.amountPaid), 0);
          return (
            <div key={m} className="mb-3.5 rounded-lg border border-gray-200 p-3">
              <div className="mb-2 flex items-center justify-between">
                <b className="text-sm">{m}</b>
                <span className="text-sm font-semibold text-brand">共 {fmt(monthTotal)}</span>
              </div>
              <div className="space-y-2">
                {rows.map((p) => (
                  <div key={p.id} className="flex flex-wrap items-start justify-between gap-3 rounded-md bg-gray-50 p-2.5">
                    <div className="min-w-[120px]">
                      <div className="text-sm">{fmt(p.amountPaid)}</div>
                      <div className="text-xs text-gray-400">{fmtDate(p.paidDate)}</div>
                      {p.receiptLink && (
                        <button
                          type="button"
                          onClick={() => setZoomUrl(p.receiptLink)}
                          className="mt-1 text-xs font-semibold text-brand underline"
                        >
                          🧾 查看转账证明
                        </button>
                      )}
                    </div>
                    <div className="min-w-[140px]">
                      <StepTimeline steps={buildAcSteps(p)} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {zoomUrl && <Lightbox src={zoomUrl} alt="转账证明" onClose={() => setZoomUrl(null)} />}
    </div>
  );
}
