"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/components/LanguageProvider";
import { fmtDate, fmtMoney } from "@/lib/format";
import { expenseCategoryLabelLocale } from "@/lib/config";

interface Cell {
  revenue: { RENTAL: number; CARPARK: number; OTHER: number };
  revenueTotal: number;
  ownerRent: number;
  landlordShare: number;
  expenses: Record<string, number>;
  legacyMaintenance: number;
  legacyCommission: number;
  costTotal: number;
  net: number;
}
interface Line {
  key: string;
  label: string;
  ref: string;
  date: string;
  amount: number;
  notes: string | null;
}
interface Unit extends Cell {
  key: string;
  propertyCode: string | null;
  name: string | null;
  kind: "LEASED" | "MANAGED" | "OWNED" | "UNASSIGNED";
  lines: Line[];
}
interface PnlData {
  label: string;
  months: string[];
  units: Unit[];
  unitsTotal: Cell;
  overhead: Cell & { lines: Line[] };
  companyNet: number;
  trend: { month: string; revenue: number; cost: number; net: number }[];
}

type Period = "month" | "quarter" | "year";

const thisMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

/** "-RM1,234.00" rather than "RM-1,234.00" for losses. */
const signed = (v: number) => (v < 0 ? `-${fmtMoney(-v)}` : fmtMoney(v));

function NetText({ v, className = "" }: { v: number; className?: string }) {
  return <span className={`${v < 0 ? "text-red-600" : "text-green-700"} ${className}`}>{signed(v)}</span>;
}

export default function PnlClient() {
  const { t, locale } = useLanguage();
  const now = new Date();
  const [period, setPeriod] = useState<Period>("month");
  const [month, setMonth] = useState(thisMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [quarter, setQuarter] = useState(Math.floor(now.getMonth() / 3) + 1);
  const [data, setData] = useState<PnlData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [sort, setSort] = useState<"code" | "net">("code");

  const query = useMemo(() => {
    if (period === "month") return `period=month&month=${month}`;
    if (period === "quarter") return `period=quarter&year=${year}&q=${quarter}`;
    return `period=year&year=${year}`;
  }, [period, month, year, quarter]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/pnl?${query}`);
      const d = await res.json();
      if (!d.success) setError(d.message);
      else setData(d);
    } catch {
      setError(t("出错，请稍后再试", "Something went wrong — please try again later"));
    } finally {
      setLoading(false);
    }
  }, [query, t]);

  useEffect(() => {
    // setState happens after the fetch's await, not synchronously in the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const costLabel = (key: string) =>
    key === "LEGACY_MAINTENANCE"
      ? t("维修（旧记录）", "Maintenance (older records)")
      : key === "LEGACY_COMMISSION"
        ? t("Agent 佣金（旧记录）", "Agent commission (older records)")
        : expenseCategoryLabelLocale(key, null, locale);

  const units = useMemo(() => {
    if (!data) return [];
    const list = [...data.units];
    if (sort === "net") list.sort((a, b) => a.net - b.net);
    return list;
  }, [data, sort]);

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);
  const maxAbs = data ? Math.max(1, ...data.trend.map((m) => Math.max(m.revenue, m.cost))) : 1;

  function breakdown(c: Cell, lines: Line[], isOverhead = false) {
    const rows: [string, number][] = [];
    if (!isOverhead) {
      rows.push([t("租金", "Rent"), c.revenue.RENTAL], [t("车位", "Carpark"), c.revenue.CARPARK], [t("其他收入", "Other income"), c.revenue.OTHER]);
    }
    const costs: [string, number][] = [];
    if (c.ownerRent) costs.push([t("付屋主租金", "Rent to owner"), c.ownerRent]);
    if (c.landlordShare) costs.push([t("屋主分成（管理单位）", "Landlord share (managed)"), c.landlordShare]);
    for (const [k, v] of Object.entries(c.expenses).sort((a, b) => b[1] - a[1])) costs.push([costLabel(k), v]);
    if (c.legacyMaintenance) costs.push([costLabel("LEGACY_MAINTENANCE"), c.legacyMaintenance]);
    if (c.legacyCommission) costs.push([costLabel("LEGACY_COMMISSION"), c.legacyCommission]);
    return (
      <div className="mt-3 space-y-3 border-t border-gray-100 pt-3 text-sm">
        {!isOverhead && (
          <div>
            <div className="mb-1 text-xs font-semibold text-gray-500">{t("收入", "Income")}</div>
            {rows.map(([k, v]) => (
              <div key={k} className="flex justify-between py-0.5">
                <span className="text-gray-600">{k}</span>
                <span>{fmtMoney(v)}</span>
              </div>
            ))}
          </div>
        )}
        <div>
          <div className="mb-1 text-xs font-semibold text-gray-500">{t("成本", "Costs")}</div>
          {costs.length === 0 ? (
            <div className="text-gray-300">-</div>
          ) : (
            costs.map(([k, v]) => (
              <div key={k} className="flex justify-between py-0.5">
                <span className="text-gray-600">{k}</span>
                <span>{fmtMoney(v)}</span>
              </div>
            ))
          )}
        </div>
        {lines.length > 0 && (
          <div>
            <div className="mb-1 text-xs font-semibold text-gray-500">{t("每一笔支出", "Every cost entry")}</div>
            <div className="divide-y divide-gray-100 rounded-lg border border-gray-100">
              {lines.map((l, i) => (
                <div key={i} className="px-2.5 py-2">
                  <div className="flex justify-between gap-2">
                    <span className="min-w-0">
                      <b>{costLabel(l.key)}</b>
                      {l.label && <span className="text-gray-600"> · {l.label}</span>}
                    </span>
                    <span className="shrink-0 font-semibold">{fmtMoney(l.amount)}</span>
                  </div>
                  <div className="text-xs text-gray-400">
                    {fmtDate(l.date)} · {l.ref}
                  </div>
                  {l.notes && <div className="text-xs text-gray-500">{l.notes}</div>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-brand">📈 {t("损益表 P&L", "Profit & Loss")}</h3>
          {data && (
            <a href={`/api/pnl?${query}&format=xlsx`} className="btn-soft px-3 py-1.5 text-xs">
              ⬇️ Excel
            </a>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg bg-brand-light p-0.5">
            {(
              [
                ["month", t("月", "Month")],
                ["quarter", t("季", "Quarter")],
                ["year", t("年", "Year")],
              ] as const
            ).map(([k, lbl]) => (
              <button
                key={k}
                onClick={() => setPeriod(k)}
                className={`rounded-md px-3.5 py-1.5 text-sm font-semibold ${period === k ? "bg-brand text-white" : "text-brand"}`}
              >
                {lbl}
              </button>
            ))}
          </div>
          {period === "month" ? (
            <input type="month" className="input w-auto" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} />
          ) : (
            <>
              <select className="input w-auto" value={year} onChange={(e) => setYear(Number(e.target.value))}>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              {period === "quarter" && (
                <select className="input w-auto" value={quarter} onChange={(e) => setQuarter(Number(e.target.value))}>
                  {[1, 2, 3, 4].map((q) => (
                    <option key={q} value={q}>
                      Q{q}
                    </option>
                  ))}
                </select>
              )}
            </>
          )}
        </div>
        {error && <div className="mt-2 text-sm text-red-600">{error}</div>}
      </div>

      {loading && !data && <div className="rounded-xl bg-white p-5 text-sm text-gray-400 shadow-sm">{t("计算中…", "Calculating…")}</div>}

      {data && (
        <div className={loading ? "opacity-60" : ""}>
          <div className="mb-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            {(
              [
                [t("营业额", "Revenue"), data.unitsTotal.revenueTotal, "text-gray-900"],
                [t("单位成本", "Unit costs"), data.unitsTotal.costTotal, "text-gray-900"],
                [t("公司开销", "Company overhead"), data.overhead.costTotal, "text-gray-900"],
                [t("公司净利润", "Company net profit"), data.companyNet, data.companyNet < 0 ? "text-red-600" : "text-green-700"],
              ] as const
            ).map(([lbl, v, cls]) => (
              <div key={lbl} className="rounded-xl bg-white p-3.5 shadow-sm">
                <div className="text-xs text-gray-500">{lbl}</div>
                <div className={`text-lg font-bold ${cls}`}>{signed(v)}</div>
              </div>
            ))}
          </div>

          {data.trend.length > 1 && (
            <div className="mb-4 rounded-xl bg-white p-4 shadow-sm">
              <h4 className="mb-2.5 text-sm font-semibold text-brand">{t("📅 每月", "📅 By month")}</h4>
              <div className="space-y-2">
                {data.trend.map((m) => (
                  <div key={m.month} className="grid grid-cols-[52px_1fr_auto] items-center gap-2 text-xs">
                    <span className="text-gray-500">{m.month.slice(2)}</span>
                    <div className="space-y-0.5">
                      <div className="h-2 rounded-full bg-violet-400" style={{ width: `${(m.revenue / maxAbs) * 100}%` }} />
                      <div className="h-2 rounded-full bg-gray-300" style={{ width: `${(m.cost / maxAbs) * 100}%` }} />
                    </div>
                    <NetText v={m.net} className="w-24 text-right font-semibold" />
                  </div>
                ))}
              </div>
              <div className="mt-2 flex gap-3 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2 w-3 rounded bg-violet-400" /> {t("营业额", "Revenue")}
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2 w-3 rounded bg-gray-300" /> {t("成本", "Cost")}
                </span>
                <span>{t("右边 = 净利润", "Right = net")}</span>
              </div>
            </div>
          )}

          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-600">
              {t("各单位", "By unit")} · {data.label}
            </h4>
            <select className="input w-auto py-1 text-xs" value={sort} onChange={(e) => setSort(e.target.value as "code" | "net")}>
              <option value="code">{t("按单位排序", "Sort by unit")}</option>
              <option value="net">{t("亏最多的在前", "Biggest loss first")}</option>
            </select>
          </div>

          <div className="grid gap-2.5 lg:grid-cols-2">
            {units.map((u) => {
              const margin = u.revenueTotal ? (u.net / u.revenueTotal) * 100 : null;
              return (
                <div key={u.key} className="rounded-xl bg-white p-4 shadow-sm">
                  <button className="w-full text-left" onClick={() => setOpen(open === u.key ? null : u.key)}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold">
                          {u.propertyCode ?? t("未分配单位", "No unit")}{" "}
                          <span className="font-normal text-gray-500">{u.name}</span>
                        </div>
                        <div className="mt-0.5 text-xs text-gray-500">
                          {t("营业额", "Revenue")} {fmtMoney(u.revenueTotal)} · {t("成本", "Cost")} {fmtMoney(u.costTotal)}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <NetText v={u.net} className="font-bold" />
                        <div className="text-xs text-gray-400">
                          {margin !== null ? `${margin.toFixed(0)}%` : "-"} {open === u.key ? "▲" : "▼"}
                        </div>
                      </div>
                    </div>
                  </button>
                  {open === u.key && (
                    <>
                      {breakdown(u, u.lines)}
                      {u.propertyCode && (
                        <Link href={`/units/${u.propertyCode}`} className="mt-2 inline-block text-xs text-brand underline">
                          {t("打开单位页面 →", "Open unit page →")}
                        </Link>
                      )}
                    </>
                  )}
                </div>
              );
            })}

            <div className="rounded-xl border border-dashed border-gray-300 bg-white p-4 shadow-sm">
              <button className="w-full text-left" onClick={() => setOpen(open === "__overhead" ? null : "__overhead")}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold">🏢 {t("公司开销", "Company overhead")}</div>
                    <div className="mt-0.5 text-xs text-gray-500">
                      {t("不属于任何单位的支出", "Costs not tied to any unit")}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="font-bold text-red-600">-{fmtMoney(data.overhead.costTotal)}</span>
                    <div className="text-xs text-gray-400">{open === "__overhead" ? "▲" : "▼"}</div>
                  </div>
                </div>
              </button>
              {open === "__overhead" && breakdown(data.overhead, data.overhead.lines, true)}
            </div>
          </div>

          <p className="mt-3 text-xs text-gray-400">
            {t(
              "营业额 = 已收的租金、车位和其他费用（不含押金）。成本 = 付屋主租金 + 所有支出（含已批准的报销、维修、Agent 佣金、代金券）。支出按所属月份计算。",
              "Revenue = rent, carpark and other fees received (deposits excluded). Costs = owner rent + all expenses (incl. approved claims, maintenance, agent commissions, vouchers), by the month they belong to."
            )}
          </p>
        </div>
      )}
    </div>
  );
}
