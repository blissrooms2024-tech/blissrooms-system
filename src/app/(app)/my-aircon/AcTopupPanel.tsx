"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Lightbox from "@/components/Lightbox";
import StepTimeline, { TimelineStep } from "@/components/StepTimeline";
import { useToast } from "@/components/Toast";
import { useLanguage } from "@/components/LanguageProvider";
import { COMPANY } from "@/lib/config";
import { fmtDate, fmtDateTime, fmtMoney as fmt, isPdfUrl } from "@/lib/format";
import { readAsDataURL, isOversized } from "@/lib/imageUpload";

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
  periodMonth: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  /** Full timestamps (paidDate / reviewedAt above are the day only) */
  paidAt?: string | null;
  reviewedAtTime?: string | null;
}

/** From GET /api/contracts/[id]/aircon. */
interface AirconInfo {
  plan: "PREPAID" | "POSTPAID" | "SWITCHING";
  from: string | null;
  rate: number;
  pays: boolean;
  /** Unused top-up still to come off aircon bills */
  balance: number;
  months: {
    period: string;
    usage: number;
    amount: number;
    /** Taken from the prepaid balance this month */
    credit: number;
    meters: { previous: number | null; reading: number | null; usage: number; rate: number; photoUrl: string | null }[];
    bill: { paymentCode: string; amountDue: number; status: string; dueDate: string | null; overdueDays: number } | null;
  }[];
}

const BILL_STATUS: Record<string, { zh: string; en: string; cls: string }> = {
  PENDING: { zh: "未付", en: "Unpaid", cls: "bg-amber-50 text-amber-700" },
  PENDING_REVIEW: { zh: "交易单审核中", en: "Slip in review", cls: "bg-sky-50 text-sky-700" },
  REJECTED: { zh: "交易单被拒绝", en: "Slip rejected", cls: "bg-rose-50 text-rose-700" },
  Paid: { zh: "已付", en: "Paid", cls: "bg-teal-50 text-teal-700" },
};

/** "2026-12" → "12月" / "Dec 2026" */
function monthName(period: string, t: (zh: string, en: string) => string) {
  const [y, m] = period.split("-").map(Number);
  return t(`${y}年${m}月`, new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en", { month: "short", year: "numeric", timeZone: "UTC" }));
}
const nextMonth = (period: string) => {
  const d = new Date(`${period}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 7);
};

function monthOf(v: string | null, t: (zh: string, en: string) => string) {
  return v ? v.slice(0, 7) : t("未知月份", "Unknown month");
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
      sublabel: p.paidDate ? fmtDateTime(p.paidAt ?? p.paidDate) : undefined,
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
          : currentIndex === 2 && p.reviewedBy
            ? `${p.reviewedBy} · ${fmtDateTime(p.reviewedAtTime ?? p.reviewedAt)}`
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
  const [info, setInfo] = useState<AirconInfo | null>(null);

  const load = useCallback(async () => {
    const [res, ac] = await Promise.all([
      fetch(`/api/contracts/${contractCode}/payments`).then((r) => r.json()),
      fetch(`/api/contracts/${contractCode}/aircon`).then((r) => r.json()),
    ]);
    if (!res.success) {
      toast.danger(res.message);
      return;
    }
    setHasAircon(!!res.contract?.room?.hasAircon);
    // Only prepaid top-ups; metered aircon bills (with a billing month) are on the bills page.
    setPayments((res.payments as AcPayment[]).filter((p) => p.type === "AC" && !p.periodMonth));
    if (ac.success) setInfo(ac as AirconInfo);
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
    if (isOversized(topupFile)) {
      toast.warning(t("文件太大(超过3MB)，请压缩", "File too large (over 3MB) — please compress it"));
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

  if (!hasAircon && info?.plan !== "POSTPAID") {
    return (
      <div className="rounded-xl bg-white p-5 text-center text-sm text-gray-400 shadow-sm">
        {t("这间房没有冷气，不需要冷气充值。", "This room has no air-cond, so no top-up is needed.")}
      </div>
    );
  }

  if (info?.plan === "POSTPAID") {
    const overdue = info.months.reduce((n, m) => Math.max(n, m.bill?.overdueDays ?? 0), 0);
    return (
      <div className="space-y-4">
        {overdue > 0 && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            <b>{t(`冷气账单已经逾期 ${overdue} 天`, `Your air-cond bill is ${overdue} days overdue`)}</b>
            <p className="mt-1">
              {t("按合约，公司可以暂停冷气供电，直到账单付清。请尽快到「我的账单」付款并上传交易单。", "Under the tenancy agreement, the company may suspend the air-cond supply until the bill is paid. Please pay and upload your slip in My Bills.")}
            </p>
          </div>
        )}
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <h3 className="text-lg font-bold text-brand">{t("❄️ 冷气月结", "❄️ Air-Cond — Billed Monthly")}</h3>
          {info.pays ? (
            <>
              <p className="mt-2 text-sm text-gray-700">
                {t(
                  `冷气已经改成月结，不用再充值，也不会因为余额用完而断电。每个月底抄一次冷气电表，按 RM${info.rate.toFixed(2)}/度 收费，账单会在下个月初出现在「我的账单」。`,
                  `Air-cond is now billed monthly — no more top-ups, and it won't cut off when credit runs out. The meter is read at each month end and charged at RM${info.rate.toFixed(2)}/kWh; the bill appears in My Bills early the next month.`
                )}
              </p>
              {info.balance > 0 && (
                <p className="mt-2 rounded-lg bg-teal-50 p-2.5 text-sm text-teal-800">
                  {t(`你还有 ${fmt(info.balance)} 以前充值没用完，会先从冷气账单扣，扣完为止。`, `You still have ${fmt(info.balance)} of unused top-up; it comes off your aircon bills first until it runs out.`)}
                </p>
              )}
              <Link href="/my-bills" className="btn-primary mt-3 inline-block">
                {t("去我的账单", "Go to My Bills")}
              </Link>
            </>
          ) : (
            <p className="mt-2 text-sm text-gray-700">
              {t("冷气已经改成月结。你的合同不另外收冷气费，下面是每个月的用量记录。", "Air-cond is now billed monthly. Your contract doesn't charge for it separately — below is your monthly usage.")}
            </p>
          )}
        </div>

        <div className="rounded-xl bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-base font-semibold text-brand">{t("📅 每月冷气用量", "📅 Monthly Usage")}</h3>
          {info.months.length === 0 && (
            <div className="py-6 text-center text-sm text-gray-400">
              {info.from
                ? t(`还没有月结记录。${monthName(info.from, t)}的冷气账单会在${monthName(nextMonth(info.from), t)}初开出。`, `No monthly bills yet. The ${monthName(info.from, t)} bill comes early ${monthName(nextMonth(info.from), t)}.`)
                : t("还没有月结记录。", "No monthly bills yet.")}
            </div>
          )}
          <div className="space-y-2.5">
            {info.months.map((m) => {
              const st = m.bill ? BILL_STATUS[m.bill.status] : null;
              return (
                <div key={m.period} className="rounded-lg border border-gray-200 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <b className="text-sm">{monthName(m.period, t)}</b>
                    <span className="text-sm font-semibold text-brand">{m.bill ? fmt(m.bill.amountDue) : info.pays ? fmt(m.amount) : t(`${m.usage} 度`, `${m.usage} kWh`)}</span>
                  </div>
                  {m.meters.map((r, i) => (
                    <div key={i} className="mt-1 text-xs text-gray-500">
                      {r.previous !== null && r.reading !== null ? `${r.previous} → ${r.reading} = ` : ""}
                      {t(`${r.usage} 度`, `${r.usage} kWh`)} × RM{r.rate.toFixed(2)}
                      {r.photoUrl && (
                        <button type="button" onClick={() => setZoomUrl(r.photoUrl)} className="ml-2 font-semibold text-brand underline">
                          {t("📷 电表照片", "📷 Meter photo")}
                        </button>
                      )}
                    </div>
                  ))}
                  {m.credit > 0 && (
                    <div className="mt-1 text-xs text-teal-700">{t(`已扣预付余额 ${fmt(m.credit)}`, `${fmt(m.credit)} taken from your prepaid balance`)}</div>
                  )}
                  <div className="mt-1.5">
                    {st ? (
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${st.cls}`}>
                        {t(st.zh, st.en)}
                        {m.bill && m.bill.overdueDays > 0 ? t(` · 逾期 ${m.bill.overdueDays} 天`, ` · ${m.bill.overdueDays} days overdue`) : ""}
                      </span>
                    ) : m.credit > 0 ? (
                      <span className="text-[11px] text-teal-700">{t("全部用预付余额付清", "Fully paid from your prepaid balance")}</span>
                    ) : (
                      <span className="text-[11px] text-gray-400">{info.pays ? t("这个月没有冷气账单", "No aircon bill this month") : t("公司承担", "Paid by the company")}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {payments.length > 0 && (
          <details className="rounded-xl bg-white p-5 shadow-sm">
            <summary className="cursor-pointer text-sm font-semibold text-gray-600">{t("以前的充值记录", "Past top-ups")}</summary>
            <div className="mt-3 space-y-2">
              {payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 rounded-md bg-gray-50 p-2.5 text-sm">
                  <span>{fmtDate(p.paidDate)}</span>
                  <span className="font-medium">{fmt(p.amountPaid)}</span>
                </div>
              ))}
            </div>
          </details>
        )}

        {zoomUrl && <Lightbox src={zoomUrl} alt={t("电表照片", "Meter photo")} onClose={() => setZoomUrl(null)} />}
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
      {info?.plan === "SWITCHING" && info.from && (
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
          <b>{t(`${monthName(info.from, t)}1号起，冷气改成月结`, `From 1 ${monthName(info.from, t)}, air-cond is billed monthly`)}</b>
          <p className="mt-1">
            {t(
              `之后不用再充值，也不会因为余额用完而断电：每个月底抄表，按 RM${info.rate.toFixed(2)}/度 收费，账单出现在「我的账单」。在那之前照常充值。`,
              `After that there are no top-ups and no cut-offs: the meter is read at each month end and charged at RM${info.rate.toFixed(2)}/kWh in My Bills. Until then, top up as usual.`
            )}
          </p>
        </div>
      )}
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
            accept="image/*,application/pdf"
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
                      <div className="text-xs text-gray-400">{fmtDateTime(p.paidAt ?? p.paidDate)}</div>
                      {p.receiptLink && (
                        isPdfUrl(p.receiptLink) ? (
                          <a
                            href={p.receiptLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1 inline-block text-xs font-semibold text-brand underline"
                          >
                            {t("📄 查看转账证明 (PDF)", "📄 View Proof of Transfer (PDF)")}
                          </a>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setZoomUrl(p.receiptLink)}
                            className="mt-1 text-xs font-semibold text-brand underline"
                          >
                            {t("🧾 查看转账证明", "🧾 View Proof of Transfer")}
                          </button>
                        )
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
