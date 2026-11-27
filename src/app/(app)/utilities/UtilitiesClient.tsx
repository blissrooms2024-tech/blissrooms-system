"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Pill from "@/components/Pill";
import Sheet from "@/components/Sheet";
import { useLanguage } from "@/components/LanguageProvider";
import { useToast } from "@/components/Toast";
import { IconBolt, IconChevronRight, IconPlus, IconSliders } from "@/components/icons";
import { fmtMoney } from "@/lib/format";
import { KIND_LABELS, UTILITY_KINDS, type UtilityKind } from "@/lib/utilitySplit";
import MonthSwitcher from "./MonthSwitcher";

type Overview = {
  period: string;
  defaultPeriod: string;
  rates: Record<UtilityKind, number>;
  units: {
    propertyCode: string;
    name: string;
    kinds: UtilityKind[];
    meterCount: number;
    /** YYYY-MM the unit's first meter starts */
    since: string;
    /** Its meters only start after this month — not flagged as missing. */
    startsLater: boolean;
    run: {
      runCode: string;
      total: number;
      billed: number;
      company: number;
      credit: number;
      bills: number;
      paid: number;
      collected: number;
      kwh: Record<UtilityKind, number>;
    } | null;
  }[];
  unitsWithoutMeters: { propertyCode: string; name: string }[];
  /** Aircon rooms with no aircon meter yet — still on prepaid top-up. */
  prepaidAc: { propertyCode: string; name: string; rooms: string[] }[];
};

const thisMonthMY = () => new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 7);

/** 抄表开单 — every unit whose usage is billed to tenants, and whether the month is done. */
export default function UtilitiesClient({ isAdmin, initialPeriod }: { isAdmin: boolean; initialPeriod: string | null }) {
  const { t } = useLanguage();
  const toast = useToast();
  const [period, setPeriod] = useState<string | null>(null);
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [editRates, setEditRates] = useState<Record<UtilityKind, string> | null>(null);
  const [savingRates, setSavingRates] = useState(false);

  const load = useCallback(
    async (p: string | null) => {
      setLoading(true);
      try {
        const d = await fetch(`/api/utilities${p ? `?period=${p}` : ""}`).then((r) => r.json());
        if (!d.success) return setError(d.message);
        setError("");
        setData(d);
        setPeriod(d.period);
        if (p) window.history.replaceState(null, "", `/utilities?period=${p}`);
      } catch {
        setError(t("网络连接失败，请检查网络后重试", "Network connection failed — please try again"));
      } finally {
        setLoading(false);
      }
    },
    [t]
  );

  useEffect(() => {
    // Every setState in load() happens after the fetch's await, not synchronously in the effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(initialPeriod);
  }, [load, initialPeriod]);

  async function saveRates() {
    if (!editRates) return;
    setSavingRates(true);
    try {
      const body = Object.fromEntries(UTILITY_KINDS.map((k) => [k, Number(editRates[k])]));
      const d = await fetch("/api/utilities/rates", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
      if (!d.success) return toast.danger(d.message);
      toast.success(d.message);
      setEditRates(null);
      load(period);
    } finally {
      setSavingRates(false);
    }
  }

  const todo = data?.units.filter((u) => !u.run && !u.startsLater) ?? [];
  const done = data?.units.filter((u) => u.run) ?? [];
  const later = data?.units.filter((u) => !u.run && u.startsLater) ?? [];
  const prepaidRooms = data?.prepaidAc.reduce((n, u) => n + u.rooms.length, 0) ?? 0;
  // The month's totals across every billed unit.
  const sum = (f: (r: NonNullable<Overview["units"][number]["run"]>) => number) => done.reduce((s, u) => s + (u.run ? f(u.run) : 0), 0);
  const totals = done.length
    ? {
        billed: sum((r) => r.billed),
        company: sum((r) => r.company),
        credit: sum((r) => r.credit),
        collected: sum((r) => r.collected),
        bills: sum((r) => r.bills),
        paid: sum((r) => r.paid),
        kwh: UTILITY_KINDS.map((k) => [k, Math.round(sum((r) => r.kwh[k]) * 100) / 100] as const).filter(([, v]) => v > 0),
      }
    : null;

  return (
    <div className="app-type mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{t("抄表开单", "Meter billing")}</h1>
          <p className="text-sm text-gray-500">{t("电费、洗衣烘干、冷气按度数收", "Electricity, washer & dryer and aircon, billed by kWh")}</p>
        </div>
        {period && <MonthSwitcher value={period} max={thisMonthMY()} onChange={(p) => load(p)} />}
      </div>

      {data && (
        <button
          type="button"
          onClick={() => isAdmin && setEditRates(Object.fromEntries(UTILITY_KINDS.map((k) => [k, String(data.rates[k])])) as Record<UtilityKind, string>)}
          className={`flex w-full items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 text-left text-sm shadow-sm ${isAdmin ? "hover:bg-gray-50" : "cursor-default"}`}
        >
          <span className="flex flex-wrap gap-x-3 gap-y-1 text-gray-600">
            {UTILITY_KINDS.map((k) => (
              <span key={k}>
                {t(KIND_LABELS[k].zh, KIND_LABELS[k].en)} <b className="text-gray-900">RM{data.rates[k].toFixed(2)}</b>
              </span>
            ))}
            <span className="text-gray-400">{t("/ 度", "/ kWh")}</span>
          </span>
          {isAdmin && (
            <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-brand">
              <IconSliders size={15} />
              {t("改单价", "Rates")}
            </span>
          )}
        </button>
      )}

      {error && <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
      {!data && !error && <div className="h-40 animate-pulse rounded-[20px] bg-white/80 motion-reduce:animate-none" />}

      {data && (
        <div className={`space-y-4 transition-opacity ${loading ? "opacity-50" : ""}`}>
          {data.units.length === 0 && (
            <div className="rounded-[20px] bg-white px-6 py-10 text-center shadow-sm">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-amber-50 text-amber-700">
                <IconBolt size={24} />
              </span>
              <p className="mt-3 font-medium text-gray-900">{t("还没有单位登记电表", "No unit has meters yet")}</p>
              <p className="mt-1 text-sm text-gray-500">{t("从下面选一个单位，登记它的电费、洗衣烘干或冷气电表。", "Pick a unit below and register its electricity, washer & dryer or aircon meters.")}</p>
            </div>
          )}

          {totals && (
            <section className="rounded-[20px] bg-white p-4 shadow-sm">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-[15px] font-semibold text-gray-900">{t(`${Number(data.period.slice(5))}月合计`, `${data.period} totals`)}</h2>
                <span className="text-xs text-gray-500">{t(`${done.length} 个单位已开单`, `${done.length} units billed`)}</span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <div className="rounded-2xl bg-gray-50 px-3 py-2.5">
                  <div className="text-[11px] text-gray-500">{t("租客要付", "Tenants owe")}</div>
                  <div className="mt-0.5 font-semibold tabular-nums text-gray-900">{fmtMoney(totals.billed)}</div>
                </div>
                <div className="rounded-2xl bg-gray-50 px-3 py-2.5">
                  <div className="text-[11px] text-gray-500">{t("已收", "Collected")}</div>
                  <div className="mt-0.5 font-semibold tabular-nums text-gray-900">{fmtMoney(totals.collected)}</div>
                  <div className="text-[11px] text-gray-500">{t(`${totals.paid}/${totals.bills} 张`, `${totals.paid}/${totals.bills} bills`)}</div>
                </div>
                <div className="rounded-2xl bg-gray-50 px-3 py-2.5">
                  <div className="text-[11px] text-gray-500">{t("公司承担", "Company pays")}</div>
                  <div className="mt-0.5 font-semibold tabular-nums text-gray-900">{fmtMoney(totals.company)}</div>
                </div>
              </div>
              {totals.credit > 0 && (
                <p className="mt-2.5 text-xs text-gray-500">{t(`另外从租客的预付余额扣了 ${fmtMoney(totals.credit)}`, `Plus ${fmtMoney(totals.credit)} taken from tenants' prepaid balances`)}</p>
              )}
              {totals.kwh.length > 0 && (
                <p className="mt-2.5 text-xs text-gray-500">
                  {totals.kwh.map(([k, v]) => `${t(KIND_LABELS[k].zh, KIND_LABELS[k].en)} ${v.toLocaleString("en-US")} ${t("度", "kWh")}`).join(" · ")}
                </p>
              )}
            </section>
          )}

          {todo.length > 0 && (
            <section>
              <h2 className="mb-2 px-1 text-sm font-semibold text-gray-500">{t(`还没抄表 · ${todo.length}`, `Not billed yet · ${todo.length}`)}</h2>
              <ul className="space-y-2.5">
                {todo.map((u) => (
                  <UnitRow key={u.propertyCode} u={u} period={data.period} />
                ))}
              </ul>
            </section>
          )}
          {done.length > 0 && (
            <section>
              <h2 className="mb-2 px-1 text-sm font-semibold text-gray-500">{t(`已开单 · ${done.length}`, `Billed · ${done.length}`)}</h2>
              <ul className="space-y-2.5">
                {done.map((u) => (
                  <UnitRow key={u.propertyCode} u={u} period={data.period} />
                ))}
              </ul>
            </section>
          )}
          {later.length > 0 && (
            <section>
              <h2 className="px-1 text-sm font-semibold text-gray-500">{t(`电表之后才开始收 · ${later.length}`, `Meters start in a later month · ${later.length}`)}</h2>
              <p className="mb-2 px-1 text-xs text-gray-400">{t("这个月不用开，不算漏开。", "Nothing to bill this month — not counted as missing.")}</p>
              <ul className="space-y-2.5">
                {later.map((u) => (
                  <UnitRow key={u.propertyCode} u={u} period={data.period} />
                ))}
              </ul>
            </section>
          )}

          {data.prepaidAc.length > 0 && (
            <section>
              <h2 className="px-1 text-sm font-semibold text-gray-500">
                {t(`冷气还在预付充值 · ${prepaidRooms} 间房`, `Aircon still on top-up · ${prepaidRooms} rooms`)}
              </h2>
              <p className="mb-2 px-1 text-xs text-gray-400">
                {t("登记那间房的冷气电表，就改成月结，租客不能再充值。", "Register a room's aircon meter to bill it monthly; top-ups stop for that room.")}
              </p>
              <ul className="divide-y divide-gray-100 overflow-hidden rounded-[20px] bg-white shadow-sm">
                {data.prepaidAc.map((u) => (
                  <li key={u.propertyCode}>
                    <Link href={`/utilities/${u.propertyCode}${isAdmin ? "?setup=ac" : ""}`} className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-gray-50">
                      <span className="min-w-0">
                        <b>{u.propertyCode}</b> <span className="text-gray-500">{u.name}</span>
                        <span className="mt-0.5 block text-xs text-gray-500">{u.rooms.join(t("、", ", "))}</span>
                      </span>
                      {isAdmin && (
                        <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-brand">
                          <IconPlus size={15} />
                          {t("登记冷气电表", "Add aircon meters")}
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {isAdmin && data.unitsWithoutMeters.length > 0 && (
            <section>
              <h2 className="mb-2 px-1 text-sm font-semibold text-gray-500">{t("还没登记电表的单位", "Units without meters")}</h2>
              <ul className="divide-y divide-gray-100 overflow-hidden rounded-[20px] bg-white shadow-sm">
                {data.unitsWithoutMeters.map((u) => (
                  <li key={u.propertyCode}>
                    <Link href={`/utilities/${u.propertyCode}?period=${data.period}&setup=1`} className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-gray-50">
                      <span>
                        <b>{u.propertyCode}</b> <span className="text-gray-500">{u.name}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-brand">
                        <IconPlus size={15} />
                        {t("登记电表", "Add meters")}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      <Sheet open={!!editRates} onClose={() => !savingRates && setEditRates(null)} title={t("每度电的单价", "Rate per kWh")}>
        {editRates && (
          <>
            <div className="space-y-3">
              {UTILITY_KINDS.map((k) => (
                <label key={k} className="flex items-center justify-between gap-3">
                  <span className="text-sm text-gray-700">{t(KIND_LABELS[k].zh, KIND_LABELS[k].en)}</span>
                  <span className="flex items-center gap-2 text-sm text-gray-500">
                    RM
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      value={editRates[k]}
                      onChange={(e) => setEditRates({ ...editRates, [k]: e.target.value })}
                      className="input w-24 text-right"
                    />
                    {t("/ 度", "/ kWh")}
                  </span>
                </label>
              ))}
            </div>
            <p className="mt-3 text-xs text-gray-500">{t("只影响以后开的账单，已经开的不会变。", "Only bills issued from now on use the new rates.")}</p>
            <button type="button" onClick={saveRates} disabled={savingRates} className="btn-primary mt-4 w-full py-2.5">
              {savingRates ? t("保存中…", "Saving…") : t("保存单价", "Save rates")}
            </button>
          </>
        )}
      </Sheet>
    </div>
  );
}

function UnitRow({ u, period }: { u: Overview["units"][number]; period: string }) {
  const { t } = useLanguage();
  return (
    <li>
      <Link
        href={`/utilities/${u.propertyCode}?period=${period}`}
        className="flex items-center gap-3 rounded-[20px] bg-white p-4 shadow-[0_1px_2px_rgba(30,27,46,0.04),0_12px_28px_-18px_rgba(76,29,149,0.22)] hover:bg-gray-50"
      >
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${u.run ? "bg-teal-50 text-teal-700" : u.startsLater ? "bg-gray-100 text-gray-500" : "bg-amber-50 text-amber-700"}`}>
          <IconBolt size={22} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <b className="text-gray-900">{u.propertyCode}</b>
            <span className="truncate text-sm text-gray-500">{u.name}</span>
          </span>
          <span className="mt-0.5 block text-xs text-gray-500">
            {u.kinds.map((k) => t(KIND_LABELS[k].zh, KIND_LABELS[k].en)).join(" · ")} · {t(`${u.meterCount} 个电表`, `${u.meterCount} meters`)}
          </span>
          {u.run && (
            <span className="mt-1 block text-xs text-gray-600">
              {fmtMoney(u.run.billed)} · {t(`${u.run.bills} 张，已付 ${u.run.paid}`, `${u.run.bills} bills, ${u.run.paid} paid`)}
              {u.run.company > 0 && <span className="text-gray-400">{t(` · 公司承担 ${fmtMoney(u.run.company)}`, ` · company ${fmtMoney(u.run.company)}`)}</span>}
            </span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {u.run ? (
            <Pill tone="teal">{t("已开单", "Billed")}</Pill>
          ) : u.startsLater ? (
            <Pill>{t(`${Number(u.since.slice(5))}月起`, `From ${u.since}`)}</Pill>
          ) : (
            <Pill tone="amber">{t("还没抄表", "To do")}</Pill>
          )}
          <IconChevronRight size={16} className="text-gray-300" />
        </span>
      </Link>
    </li>
  );
}
