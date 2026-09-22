"use client";

import { useEffect, useState, useCallback } from "react";
import Lightbox from "@/components/Lightbox";
import StepTimeline, { TimelineStep } from "@/components/StepTimeline";
import { useToast } from "@/components/Toast";
import { useLanguage } from "@/components/LanguageProvider";
import { COMPANY } from "@/lib/config";
import { fmtDate } from "@/lib/format";

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
function monthOf(v: string | null, t: (zh: string, en: string) => string) {
  return v ? v.slice(0, 7) : t("未知月份", "Unknown month");
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

function buildAcSteps(p: AcPayment, t: (zh: string, en: string) => string): TimelineStep[] {
  if (p.status === "REJECTED") {
    return [
      { label: t("已提交", "Submitted"), state: "done" },
      { label: t("已拒绝", "Rejected"), sublabel: p.reviewNote ?? undefined, state: "rejected" },
    ];
  }
  const currentIndex = AC_FLOW.indexOf(p.status);
  return [
    {
      label: t("已提交", "Submitted"),
      sublabel: p.paidDate ? fmtDate(p.paidDate) : undefined,
      state: currentIndex >= 1 ? "done" : "active",
    },
    {
      label: t("已充值", "Topped Up"),
      sublabel:
        currentIndex === 1
          ? t(
              "Admin 会在12小时内更新到 Smart Meter (只在周一至五, 六日/公共假期不处理)",
              "Admin will update the Smart Meter within 12 hours (Mon–Fri only, not processed on weekends/public holidays)"
            )
          : undefined,
      state: currentIndex === 2 ? "done" : "pending",
    },
  ];
}

export default function AcTopupPanel({ contractCode }: { contractCode: string }) {
  const toast = useToast();
  const { t } = useLanguage();
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
      toast.warning(t("请填正确的充值金额", "Please enter a valid top-up amount"));
      return;
    }
    if (!topupFile) {
      toast.warning(t("请上传转账证明", "Please upload proof of transfer"));
      return;
    }
    if (topupFile.size > 3 * 1024 * 1024) {
      toast.warning(t("图片太大(超过3MB)，请压缩", "Image too large (over 3MB) — please compress it"));
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
      toast.danger(t("系统出错，请稍后再试", "System error — please try again later"));
    } finally {
      setTopupSubmitting(false);
    }
  }

  if (!hasAircon) {
    return (
      <div className="rounded-xl bg-white p-5 text-center text-sm text-gray-400 shadow-sm">
        {t("这间房没有冷气，不需要冷气充值。", "This room has no air-cond, so no top-up is needed.")}
      </div>
    );
  }

  // Group by month so tenants can see roughly how much they've been topping up per month —
  // this system has no actual kWh usage data from the smart meter, only what's been paid in.
  const byMonth = new Map<string, AcPayment[]>();
  for (const p of payments) {
    const m = monthOf(p.paidDate, t);
    byMonth.set(m, [...(byMonth.get(m) ?? []), p]);
  }
  const months = [...byMonth.keys()].sort().reverse();

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white p-5 shadow-sm">
        <h3 className="text-lg font-bold text-brand">{t("❄️ 冷气 Top-up 充值", "❄️ Air-Cond Top-Up")}</h3>
        <div className="mt-3 rounded-lg bg-brand-light/40 p-3.5 text-sm">
          <div className="font-semibold text-brand">{COMPANY.NAME}</div>
          <div className="mt-1 text-gray-700">
            {COMPANY.BANK} · Acc No: <b>{COMPANY.ACC_NO}</b>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            {t(
              "请先把充值金额转入以上公司户口，然后在下面填写金额并上传转账证明。Admin 会在收到后12小时内更新到 Smart Meter。",
              "Please transfer the top-up amount to the company account above, then fill in the amount below and upload proof of transfer. Admin will update the Smart Meter within 12 hours of receiving it."
            )}
          </p>
          <p className="mt-1 text-xs font-semibold text-amber-700">
            {t(
              "⏰ 只在星期一至星期五处理，星期六、星期日及公共假期不处理。",
              "⏰ Only processed Monday to Friday — not on Saturdays, Sundays or public holidays."
            )}
          </p>
        </div>

        <div className="mt-3.5 flex flex-wrap items-center gap-2">
          <input
            type="number"
            min="1"
            step="0.01"
            placeholder={t("金额 RM", "Amount RM")}
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
            {topupSubmitting ? t("提交中...", "Submitting...") : t("提交充值", "Submit Top-up")}
          </button>
        </div>
        {topupFile && (
          <div className="mt-1.5 text-xs text-gray-500">
            {t("已选择", "Selected")}: {topupFile.name}
          </div>
        )}
      </div>

      <div className="rounded-xl bg-white p-5 shadow-sm">
        <h3 className="mb-1 text-base font-semibold text-brand">{t("📅 每月充值记录", "📅 Monthly Top-up History")}</h3>
        <p className="mb-3 text-xs text-gray-400">
          {t(
            "系统没有 Smart Meter 实时用量数据，以下是每个月的充值金额记录",
            "The system has no real-time Smart Meter usage data — this is just the monthly top-up amount history"
          )}
        </p>
        {months.length === 0 && (
          <div className="py-6 text-center text-sm text-gray-400">{t("还没有充值记录", "No top-up history yet")}</div>
        )}
        {months.map((m) => {
          const rows = byMonth.get(m)!;
          const monthTotal = rows.reduce((s, p) => s + Number(p.amountPaid), 0);
          return (
            <div key={m} className="mb-3.5 rounded-lg border border-gray-200 p-3">
              <div className="mb-2 flex items-center justify-between">
                <b className="text-sm">{m}</b>
                <span className="text-sm font-semibold text-brand">
                  {t("共", "Total")} {fmt(monthTotal)}
                </span>
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
                          {t("🧾 查看转账证明", "🧾 View Proof of Transfer")}
                        </button>
                      )}
                    </div>
                    <div className="min-w-[140px]">
                      <StepTimeline steps={buildAcSteps(p, t)} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {zoomUrl && <Lightbox src={zoomUrl} alt={t("转账证明", "Proof of Transfer")} onClose={() => setZoomUrl(null)} />}
    </div>
  );
}
