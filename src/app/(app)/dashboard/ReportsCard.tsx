"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/components/LanguageProvider";
import { fmtMoney } from "@/lib/format";
import { expenseCategoryLabelLocale } from "@/lib/config";
import type { ReportsData } from "@/lib/reports";

const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const signed = (v: number) => (v < 0 ? `-${fmtMoney(-v)}` : fmtMoney(v));

function Net({ v, className = "" }: { v: number; className?: string }) {
  return <span className={`${v < 0 ? "text-red-600" : "text-green-700"} ${className}`}>{signed(v)}</span>;
}

function CostList({ costs, labelOf, empty }: { costs: Record<string, number>; labelOf: (key: string) => string; empty: string }) {
  const list = Object.entries(costs)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);
  if (!list.length) return <div className="text-xs text-gray-400">{empty}</div>;
  return (
    <div className="space-y-0.5 text-sm">
      {list.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-2">
          <span className="text-gray-600">{labelOf(k)}</span>
          <span>{fmtMoney(v)}</span>
        </div>
      ))}
    </div>
  );
}

export default function ReportsCard({ initial }: { initial: ReportsData }) {
  const { t, locale } = useLanguage();
  const [month, setMonth] = useState(initial.month.month);
  const [year, setYear] = useState(initial.year.year);
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showMonthCosts, setShowMonthCosts] = useState(false);
  const [openRow, setOpenRow] = useState<string | null>(null);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/dashboard/reports?month=${month}&year=${year}`);
        const d = await res.json();
        if (cancelled) return;
        if (!d.success) setError(d.message);
        else setData(d);
      } catch {
        if (!cancelled) setError(t("出错，请稍后再试", "Something went wrong — please try again later"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [month, year, t]);

  const monthName = (p: string) => {
    const [y, m] = p.split("-").map(Number);
    return locale === "en" ? `${MONTHS_EN[m - 1]} ${y}` : `${y}年${m}月`;
  };
  const shortMonth = (p: string) => {
    const m = Number(p.slice(5, 7));
    return locale === "en" ? MONTHS_EN[m - 1] : `${m}月`;
  };
  const costLabel = (key: string) => {
    if (key === "OWNER_RENT") return t("付屋主租金", "Rent to owners");
    if (key === "LANDLORD_SHARE") return t("屋主分成（管理单位）", "Landlord share (managed units)");
    if (key === "LEGACY_MAINTENANCE") return t("维修（旧记录）", "Maintenance (older records)");
    if (key === "LEGACY_COMMISSION") return t("Agent 佣金（旧记录）", "Agent commission (older records)");
    if (key.startsWith("OTHER:")) return key.slice(6);
    return expenseCategoryLabelLocale(key, null, locale);
  };
  const sortedCosts = (costs: Record<string, number>) => Object.entries(costs).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);

  const m = data.month;
  const prev = m.previous;
  const revChange = prev.revenue ? Math.round(((m.revenue - prev.revenue) / Math.abs(prev.revenue)) * 100) : null;
  const years = Array.from({ length: Number(data.currentMonth.slice(0, 4)) - data.firstYear + 1 }, (_, i) => Number(data.currentMonth.slice(0, 4)) - i);
  const maxBar = Math.max(1, ...data.year.months.map((r) => Math.max(r.revenue, r.cost)));

  return (
    <section className="rounded-xl bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-brand">📊 {t("报告", "Reports")}</h3>
        {loading && <span className="text-xs text-gray-400">{t("计算中…", "Calculating…")}</span>}
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-xs text-gray-500">{t("月报：选月份", "Monthly report")}</label>
          <input className="input" type="month" max={data.currentMonth} value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500">{t("年报：选年份", "Annual report")}</label>
          <select className="input" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>
      {error && <div className="mb-2 text-sm text-red-600">{error}</div>}

      <div className={loading ? "opacity-60" : ""}>
        {/* -------- Monthly -------- */}
        <div className="rounded-xl bg-gray-50 p-3.5">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <b className="text-gray-700">
              📅 {monthName(m.month)} {t("月报", "")}
            </b>
            {revChange !== null && (
              <span className={revChange >= 0 ? "text-green-700" : "text-red-600"}>
                {t("营业额比上月", "Revenue vs last month")} {revChange >= 0 ? "▲" : "▼"} {Math.abs(revChange)}%
              </span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-xs text-gray-500">{t("营业额", "Revenue")}</div>
              <b className="whitespace-nowrap text-sm">{fmtMoney(m.revenue)}</b>
            </div>
            <div>
              <div className="text-xs text-gray-500">{t("支出", "Costs")}</div>
              <b className="whitespace-nowrap text-sm">{fmtMoney(m.cost)}</b>
            </div>
            <div>
              <div className="text-xs text-gray-500">{t("净利润", "Net profit")}</div>
              <Net v={m.net} className="whitespace-nowrap text-sm font-bold" />
            </div>
          </div>
          <div className="mt-1.5 text-center text-xs text-gray-400">
            {t("上月", "Last month")}: {t("营业额", "revenue")} {fmtMoney(prev.revenue)} · {t("支出", "costs")} {fmtMoney(prev.cost)} · {t("净利润", "net")} {signed(prev.net)}
          </div>
          <button onClick={() => setShowMonthCosts((v) => !v)} className="mt-2 text-xs font-semibold text-brand">
            {showMonthCosts ? "▾" : "▸"} {t("这个月的收入和支出明细", "This month's income & costs")}
          </button>
          {showMonthCosts && (
            <div className="mt-2 space-y-2 rounded-lg bg-white p-2.5">
              <div className="text-xs text-gray-500">
                {t("收入", "Income")}: {t("租金", "rent")} {fmtMoney(m.revenueBy.RENTAL)} · {t("车位", "carpark")} {fmtMoney(m.revenueBy.CARPARK)} · {t("其他", "other")}{" "}
                {fmtMoney(m.revenueBy.OTHER)}
              </div>
              <CostList costs={m.costs} labelOf={costLabel} empty={t("没有支出", "No costs")} />
              <Link href={`/pnl?period=month&month=${m.month}`} className="inline-block text-xs text-brand underline">
                {t("看各单位的损益 →", "P&L by unit →")}
              </Link>
            </div>
          )}
        </div>

        {/* -------- Annual -------- */}
        <div className="mt-3 rounded-xl bg-gray-50 p-3.5">
          <div className="mb-1.5 text-xs">
            <b className="text-gray-700">
              📆 {data.year.year} {t("年报", "annual report")}
              {data.year.toDate ? t(`（到 ${shortMonth(data.year.throughMonth)}）`, ` (to ${shortMonth(data.year.throughMonth)})`) : ""}
            </b>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-xs text-gray-500">{t("营业额", "Revenue")}</div>
              <b className="whitespace-nowrap text-[13px]">{fmtMoney(data.year.totals.revenue)}</b>
            </div>
            <div>
              <div className="text-xs text-gray-500">{t("支出", "Costs")}</div>
              <b className="whitespace-nowrap text-[13px]">{fmtMoney(data.year.totals.cost)}</b>
            </div>
            <div>
              <div className="text-xs text-gray-500">{t("净利润", "Net profit")}</div>
              <Net v={data.year.totals.net} className="whitespace-nowrap text-[13px] font-bold" />
            </div>
          </div>

          <div className="mb-1.5 mt-3 text-xs font-semibold text-gray-600">{t("💸 每个月的支出（点开看明细）", "💸 Costs by month (tap for details)")}</div>
          {data.year.months.length === 0 ? (
            <div className="text-xs text-gray-400">{t("没有资料", "No data")}</div>
          ) : (
            <div className="divide-y divide-gray-200 overflow-hidden rounded-lg bg-white">
              {data.year.months.map((r) => (
                <div key={r.month}>
                  <button onClick={() => setOpenRow(openRow === r.month ? null : r.month)} className="w-full px-2.5 py-2 text-left">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <b>{shortMonth(r.month)}</b>
                      <span className="whitespace-nowrap text-xs">
                        <span className="text-gray-400">{t("净利润", "Net")} </span>
                        <Net v={r.net} className="font-semibold" />
                        <span className="ml-1 text-gray-400">{openRow === r.month ? "▾" : "▸"}</span>
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {t("营业额", "Revenue")} {fmtMoney(r.revenue)} · <span className="font-semibold text-gray-800">{t("支出", "Costs")} {fmtMoney(r.cost)}</span>
                    </div>
                    <div className="mt-1 space-y-0.5">
                      <div className="h-1.5 rounded-full bg-violet-300" style={{ width: `${(r.revenue / maxBar) * 100}%` }} />
                      <div className="h-1.5 rounded-full bg-gray-300" style={{ width: `${(r.cost / maxBar) * 100}%` }} />
                    </div>
                  </button>
                  {openRow === r.month && (
                    <div className="border-t border-gray-100 bg-gray-50/60 px-3 py-2">
                      <CostList costs={r.costs} labelOf={costLabel} empty={t("没有支出", "No costs")} />
                      <Link href={`/pnl?period=month&month=${r.month}`} className="mt-1 inline-block text-xs text-brand underline">
                        {t("看各单位 →", "By unit →")}
                      </Link>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="mt-1 flex gap-3 text-[11px] text-gray-400">
            <span className="flex items-center gap-1">
              <span className="inline-block h-1.5 w-3 rounded bg-violet-300" /> {t("营业额", "Revenue")}
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-1.5 w-3 rounded bg-gray-300" /> {t("支出", "Costs")}
            </span>
          </div>

          {sortedCosts(data.year.costTotals).length > 0 && (
            <>
              <div className="mb-1.5 mt-3 text-xs font-semibold text-gray-600">{t("🧾 全年支出分类", "🧾 Costs by type for the year")}</div>
              <div className="rounded-lg bg-white p-2.5">
                <CostList costs={data.year.costTotals} labelOf={costLabel} empty={t("没有支出", "No costs")} />
              </div>
            </>
          )}
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <Link href={`/pnl?period=year&year=${data.year.year}`} className="text-brand underline">
              {t("全年损益表（各单位）→", "Annual P&L by unit →")}
            </Link>
            <Link href="/finance" className="text-brand underline">
              {t("财务总览（现金、押金）", "Finance overview (cash, deposits)")}
            </Link>
          </div>
        </div>

        {/* -------- Sales -------- */}
        <div className="mb-2 mt-4 text-sm font-semibold text-gray-700">
          💼 {t("销售", "Sales")}：{monthName(m.month)} {t("新签", "")} <b className="text-brand">{data.sales.month}</b> {t("份", "contracts")} · {data.year.year}{" "}
          {t("年", "")} <b className="text-brand">{data.sales.year}</b> {t("份", "contracts")}
        </div>
        {data.sales.leaderboard.length === 0 ? (
          <div className="py-2 text-center text-sm text-gray-400">{t("还没有成交记录", "No deals yet")}</div>
        ) : (
          <div className="divide-y divide-gray-100 rounded-lg border border-gray-100 text-sm">
            {data.sales.leaderboard.map((a, i) => (
              <div key={a.name} className="flex items-center justify-between gap-2 px-3 py-2">
                <span>
                  {["🥇", "🥈", "🥉"][i] ?? `${i + 1}.`} <b>{a.name}</b>
                </span>
                <span className="text-xs text-gray-500">
                  {shortMonth(m.month)} <b className="text-gray-800">{a.month}</b> · {data.year.year} {a.year} · {t("累计", "Total")} {a.total}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
