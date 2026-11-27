"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Pill from "@/components/Pill";
import Sheet from "@/components/Sheet";
import { useLanguage } from "@/components/LanguageProvider";
import { useToast } from "@/components/Toast";
import { IconBolt, IconCamera, IconCheck, IconChat, IconChevronLeft, IconCopy, IconMinus, IconPlus, IconSliders, IconWrench, IconX } from "@/components/icons";
import { fmtDate, fmtMoney } from "@/lib/format";
import { compressImage, readAsDataURL } from "@/lib/imageUpload";
import { KIND_LABELS, UTILITY_KINDS, finalBills, overrideKey, round2, splitUsage, type MeterUsage, type SplitBy, type UtilityKind } from "@/lib/utilitySplit";
import { whatsappText } from "@/lib/utilityText";
import type { TenancyRow, UnitBilling } from "@/lib/utilityBilling";
import MonthSwitcher from "../MonthSwitcher";
import MeterSetupSheet from "./MeterSetupSheet";
import ExemptionSheet from "./ExemptionSheet";
import RunView from "./RunView";

type Draft = { previous: string; reading: string; usage: string; direct: boolean; photoUrl: string | null; uploading: boolean };

const todayMY = () => new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
const addDays = (iso: string, n: number) => new Date(Date.parse(iso) + n * 86_400_000).toISOString().slice(0, 10);
const card = "rounded-[20px] bg-white p-4 shadow-[0_1px_2px_rgba(30,27,46,0.04),0_12px_28px_-18px_rgba(76,29,149,0.22)]";
const KIND_TONE: Record<UtilityKind, string> = { ELECTRIC: "bg-amber-50 text-amber-700", LAUNDRY: "bg-sky-50 text-sky-700", AC: "bg-teal-50 text-teal-700" };
const KindIcon = ({ kind, size = 17 }: { kind: UtilityKind; size?: number }) => (kind === "LAUNDRY" ? <IconWrench size={size} /> : <IconBolt size={size} />);

/** 抄表开单 for one unit and one month: ① type the readings, ② see each room's share (change
 * any amount, exempt someone, leave someone out), ③ issue the bills and copy the WhatsApp
 * message. A month that's already billed shows what was issued instead. */
export default function UnitBillingClient({
  propertyCode,
  initialPeriod,
  openSetup,
  isAdmin,
}: {
  propertyCode: string;
  initialPeriod: string | null;
  openSetup: boolean;
  isAdmin: boolean;
}) {
  const { t } = useLanguage();
  const toast = useToast();
  const [data, setData] = useState<UnitBilling | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [splitBy, setSplitBy] = useState<SplitBy>("ROOM");
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [skip, setSkip] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState(() => addDays(todayMY(), 7));
  const [setupOpen, setSetupOpen] = useState(openSetup && isAdmin);
  const [exemptFor, setExemptFor] = useState<string | null>(null);
  const [issuing, setIssuing] = useState(false);
  const [issued, setIssued] = useState<{ message: string; whatsapp: string } | null>(null);
  const fileFor = useRef<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(
    async (p: string | null, freshDrafts: boolean) => {
      setLoading(true);
      try {
        const d = await fetch(`/api/utilities/${encodeURIComponent(propertyCode)}${p ? `?period=${p}` : ""}`).then((r) => r.json());
        if (!d.success) return setError(d.message);
        setError("");
        setData(d);
        setDrafts((prev) => {
          const next: Record<string, Draft> = {};
          for (const m of (d as UnitBilling).meters) {
            const keep = !freshDrafts ? prev[m.id] : undefined;
            next[m.id] = keep ?? {
              previous: m.previous === null ? "" : String(m.previous),
              reading: "",
              usage: "",
              direct: m.inputMode === "USAGE",
              photoUrl: null,
              uploading: false,
            };
          }
          return next;
        });
        if (freshDrafts) {
          setOverrides({});
          setSkip([]);
        }
        if (p) window.history.replaceState(null, "", `/utilities/${propertyCode}?period=${p}`);
      } catch {
        setError(t("网络连接失败，请检查网络后重试", "Network connection failed — please try again"));
      } finally {
        setLoading(false);
      }
    },
    [propertyCode, t]
  );

  useEffect(() => {
    // Every setState in load() happens after the fetch's await, not synchronously in the effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(initialPeriod, true);
  }, [load, initialPeriod]);

  const setDraft = (id: string, patch: Partial<Draft>) => setDrafts((s) => ({ ...s, [id]: { ...s[id], ...patch } }));

  const calc = useMemo(() => {
    if (!data) return null;
    const meters = data.meters.map((m) => {
      const d = drafts[m.id];
      let usage: number | null = null;
      let problem = "";
      if (d) {
        if (d.direct) {
          if (d.usage !== "") {
            const u = Number(d.usage);
            if (!Number.isFinite(u) || u < 0) problem = t("度数不对", "Not a valid kWh");
            else usage = round2(u);
          }
        } else {
          const prev = d.previous === "" ? null : Number(d.previous);
          const cur = d.reading === "" ? null : Number(d.reading);
          if (prev === null || !Number.isFinite(prev)) problem = t("请填上个月的读数", "Enter last month's reading");
          else if (cur !== null) {
            if (!Number.isFinite(cur) || cur < prev) problem = t("比上个月的读数小 — 换了电表就改成直接填度数", "Lower than last month — if the meter was replaced, enter kWh instead");
            else usage = round2(cur - prev);
          }
        }
      }
      return { meter: m, usage, problem, amount: usage === null ? null : round2(usage * data.rates[m.kind]) };
    });
    const usages: MeterUsage[] = meters.map((x) => ({
      meterId: x.meter.id,
      kind: x.meter.kind,
      roomId: x.meter.roomId,
      roomCode: x.meter.roomCode,
      label: x.meter.label,
      usage: x.usage ?? 0,
      rate: data.rates[x.meter.kind],
    }));
    const tenancies = data.tenancies.filter((tn) => !skip.includes(tn.contractId));
    const result = splitUsage(usages, tenancies, splitBy);
    const ov: Record<string, number> = {};
    for (const [k, v] of Object.entries(overrides)) if (v !== "" && Number.isFinite(Number(v))) ov[k] = Number(v);
    const final = finalBills(result, ov);
    const ready = meters.length > 0 && meters.every((x) => x.usage !== null && !x.problem);
    return { meters, usages, result, final, ready, ov };
  }, [data, drafts, skip, splitBy, overrides, t]);

  const kinds = useMemo(() => UTILITY_KINDS.filter((k) => data?.meters.some((m) => m.kind === k)), [data]);
  const exemptTenancy = data?.tenancies.find((x) => x.contractId === exemptFor) ?? null;

  async function pickPhoto(file: File | undefined) {
    const id = fileFor.current;
    if (!file || !id) return;
    setDraft(id, { uploading: true });
    try {
      const dataUrl = await readAsDataURL(await compressImage(file));
      const d = await fetch("/api/utilities/photo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dataUrl }) }).then((r) => r.json());
      if (!d.success) return toast.danger(d.message);
      setDraft(id, { photoUrl: d.url });
    } catch {
      toast.danger(t("照片上传失败", "Photo upload failed"));
    } finally {
      setDraft(id, { uploading: false });
    }
  }

  async function setOccupants(tn: TenancyRow, n: number) {
    if (n < 1 || n > 10 || !data) return;
    const d = await fetch(`/api/contracts/${tn.contractCode}/occupants`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ occupants: n }) }).then((r) => r.json());
    if (!d.success) return toast.danger(d.message);
    setData({ ...data, tenancies: data.tenancies.map((x) => (x.contractId === tn.contractId ? { ...x, occupants: n } : x)) });
  }

  async function issue() {
    if (!data || !calc?.ready) return;
    setIssuing(true);
    try {
      const inputs = data.meters.map((m) => {
        const d = drafts[m.id];
        return d.direct
          ? { meterId: m.id, usage: Number(d.usage), reading: null, previous: null, photoUrl: d.photoUrl }
          : { meterId: m.id, previous: Number(d.previous), reading: Number(d.reading), photoUrl: d.photoUrl };
      });
      const res = await fetch(`/api/utilities/${encodeURIComponent(propertyCode)}/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period: data.period, splitBy: byPeople ? "PEOPLE" : "ROOM", dueDate, inputs, overrides: calc.ov, skip }),
      }).then((r) => r.json());
      if (!res.success) return toast.danger(res.message);
      setIssued({ message: res.message, whatsapp: res.whatsapp });
      await load(data.period, true);
    } finally {
      setIssuing(false);
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t("已复制，可以贴到单位的 WhatsApp 群", "Copied — paste it in the unit's WhatsApp group"));
    } catch {
      toast.warning(t("复制失败，请手动复制", "Couldn't copy — please copy it manually"));
    }
  }

  const kindLabel = (k: UtilityKind) => t(KIND_LABELS[k].zh, KIND_LABELS[k].en);
  const roomOf = (tn: TenancyRow) => calc?.result.tenants.find((x) => x.tenancy.contractId === tn.contractId);
  // How the shared meters are split right now, for the line under the switch.
  const sharedOf = (k: UtilityKind) => calc?.result.meters.find((m) => !m.meter.roomId && m.meter.kind === k);
  const elecShared = sharedOf("ELECTRIC");
  const laundryShared = sharedOf("LAUNDRY");
  const rooms = calc?.result.tenants.length ?? 0;
  const byPeople = splitBy === "PEOPLE" && !!elecShared;
  const splitHint = !elecShared && !laundryShared
    ? t("这个单位没有共用的电表，每间房只付自己的冷气电表。", "No shared meters here — each room pays its own aircon meter.")
    : byPeople
      ? t(
          `电费按人数分，一共 ${elecShared.shareTotal} 人${laundryShared ? `；洗衣烘干照样 ${rooms} 间房平分` : ""}。空房不算，月中入住或搬走也算一整份。`,
          `Electricity is split by headcount: ${elecShared.shareTotal} people${laundryShared ? `; washer & dryer stays split across ${rooms} rooms` : ""}. Empty rooms don't count; mid-month moves count as a full share.`
        )
      : t(
          `${elecShared && laundryShared ? "电费和洗衣烘干" : elecShared ? "电费" : "洗衣烘干"}由 ${rooms} 间有人住的房平分；空房不算，月中入住或搬走也算一整份。`,
          `${elecShared && laundryShared ? "Electricity and washer & dryer are" : elecShared ? "Electricity is" : "Washer & dryer is"} split across ${rooms} occupied rooms; empty rooms don't count, mid-month moves count as a full share.`
        );

  const preview =
    data && calc
      ? whatsappText(
          data.unit.propertyCode,
          data.period,
          calc.usages,
          calc.final.bills.map((b) => ({ roomCode: data.tenancies.find((x) => x.contractId === b.contractId)!.roomCode, amount: b.amount })),
          dueDate
        )
      : "";

  return (
    <div className="app-type mx-auto max-w-3xl space-y-4">
      <div>
        <Link href={data ? `/utilities?period=${data.period}` : "/utilities"} className="mb-1 inline-flex items-center gap-0.5 text-sm text-gray-500 hover:text-brand">
          <IconChevronLeft size={16} />
          {t("抄表开单", "Meter billing")}
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-gray-900">
            {propertyCode}
            {data && <span className="ml-1.5 text-base font-normal text-gray-500">{data.unit.name}</span>}
          </h1>
          <div className="flex items-center gap-2">
            {data && <MonthSwitcher value={data.period} max={todayMY().slice(0, 7)} onChange={(p) => load(p, true)} />}
            {isAdmin && data && (
              <button type="button" onClick={() => setSetupOpen(true)} className="flex h-11 items-center gap-1.5 rounded-xl bg-white px-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50">
                <IconSliders size={17} />
                {t("电表", "Meters")}
              </button>
            )}
          </div>
        </div>
      </div>

      {error && <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
      {!data && !error && <div className="h-48 animate-pulse rounded-[20px] bg-white/80 motion-reduce:animate-none" />}

      {data && data.meters.length === 0 && !data.run && (
        <div className={`${card} py-10 text-center`}>
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-amber-50 text-amber-700">
            <IconBolt size={24} />
          </span>
          <p className="mt-3 font-medium text-gray-900">{t("这个单位还没有电表", "This unit has no meters yet")}</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-gray-500">
            {t("先登记要收费的电表：电费、洗衣机 + 烘干机、每间房的冷气。只要登记一次。", "Register the meters you bill: electricity, washer & dryer, each room's aircon. Only once.")}
          </p>
          {isAdmin && (
            <button type="button" onClick={() => setSetupOpen(true)} className="btn-primary mt-4 inline-flex items-center gap-1.5 px-5 py-2.5">
              <IconPlus size={18} />
              {t("登记电表", "Add meters")}
            </button>
          )}
        </div>
      )}

      {data?.run && <RunView data={data} run={data.run} isAdmin={isAdmin} onChanged={() => load(data.period, true)} />}

      {data && !data.run && data.meters.length > 0 && calc && (
        <div className={`space-y-4 transition-opacity ${loading ? "opacity-50" : ""}`}>
          {/* ① readings */}
          <section className={card}>
            <h2 className="text-[15px] font-semibold text-gray-900">{t("① 这个月用了多少度", "① kWh used this month")}</h2>
            <p className="mb-3 text-xs text-gray-500">
              {t("单价：", "Rates: ")}
              {kinds.map((k) => `${kindLabel(k)} RM${data.rates[k].toFixed(2)}`).join(" · ")}
              {t(" / 度", " / kWh")}
            </p>
            <ul className="space-y-2.5">
              {calc.meters.map(({ meter: m, usage, problem, amount }) => {
                const d = drafts[m.id];
                if (!d) return null;
                return (
                  <li key={m.id} className="rounded-2xl border border-gray-100 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${KIND_TONE[m.kind]}`}>
                          <KindIcon kind={m.kind} />
                        </span>
                        <span className="truncate">
                          {kindLabel(m.kind)} · {m.roomCode ?? t("整个单位", "whole unit")}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          fileFor.current = m.id;
                          fileInput.current?.click();
                        }}
                        aria-label={t("拍电表照片", "Photo of the meter")}
                        className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${d.photoUrl ? "bg-teal-50 text-teal-700" : "bg-gray-100 text-gray-500"} hover:brightness-95`}
                      >
                        {d.uploading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : d.photoUrl ? <IconCheck size={18} /> : <IconCamera size={18} />}
                      </button>
                    </div>

                    {d.direct ? (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="relative flex-1">
                          <input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            value={d.usage}
                            onChange={(e) => setDraft(m.id, { usage: e.target.value })}
                            placeholder="0"
                            aria-label={t("用了多少度", "kWh used")}
                            className="input h-11 pr-12"
                          />
                          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">kWh</span>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <label className="block">
                          <span className="mb-0.5 block text-[11px] text-gray-500">
                            {t("上个月读数", "Last reading")}
                            {m.previousPeriod ? ` (${m.previousPeriod})` : ""}
                          </span>
                          <input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            value={d.previous}
                            onChange={(e) => setDraft(m.id, { previous: e.target.value })}
                            className="input h-11 bg-gray-50"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-0.5 block text-[11px] text-gray-500">{t("这个月读数", "This reading")}</span>
                          <input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            value={d.reading}
                            onChange={(e) => setDraft(m.id, { reading: e.target.value })}
                            className="input h-11 border-brand/60"
                          />
                        </label>
                      </div>
                    )}

                    <div className="mt-1.5 flex items-center justify-between gap-2 text-xs">
                      {m.inputMode === "READING" ? (
                        <button type="button" onClick={() => setDraft(m.id, { direct: !d.direct })} className="text-gray-500 underline">
                          {d.direct ? t("改回填读数", "Enter the reading instead") : t("换了电表？直接填度数", "Meter replaced? Enter kWh")}
                        </button>
                      ) : (
                        <span />
                      )}
                      {problem ? (
                        <span className="text-right text-rose-600">{problem}</span>
                      ) : usage !== null ? (
                        <span className="text-gray-600">
                          {usage} {t("度", "kWh")} = <b className="text-sm text-gray-900">{fmtMoney(amount)}</b>
                        </span>
                      ) : (
                        <span className="text-gray-400">{t("还没填", "Not entered")}</span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
            <input ref={fileInput} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => {
              pickPhoto(e.target.files?.[0]);
              e.target.value = "";
            }} />
          </section>

          {/* ② split */}
          <section className={card}>
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[15px] font-semibold text-gray-900">{t("② 每间房要付多少", "② What each room pays")}</h2>
              {elecShared && (
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  {t("电费", "Electricity")}
                  <div role="group" aria-label={t("电费怎么分", "How to split electricity")} className="flex rounded-xl bg-gray-100 p-0.5 font-semibold">
                    {(["ROOM", "PEOPLE"] as const).map((s) => (
                      <button key={s} type="button" aria-pressed={splitBy === s} onClick={() => setSplitBy(s)} className={`rounded-[10px] px-3 py-1.5 ${splitBy === s ? "bg-white text-brand shadow-sm" : "text-gray-500"}`}>
                        {s === "ROOM" ? t("按房间", "By room") : t("按人数", "By people")}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <p className="mb-2 text-xs text-gray-500">{splitHint}</p>

            {data.tenancies.length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-400">{t("这个月这个单位没有租客，全部由公司承担。", "Nobody lived here this month — the company pays it all.")}</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {data.tenancies.map((tn) => {
                  const skipped = skip.includes(tn.contractId);
                  const bill = roomOf(tn);
                  const total = calc.final.bills.filter((b) => b.contractId === tn.contractId).reduce((s, b) => s + b.amount, 0);
                  return (
                    <li key={tn.contractId} className={`py-3 ${skipped ? "opacity-50" : ""}`}>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="min-w-0">
                          <b className="font-semibold">{tn.roomCode}</b> <span className="text-sm text-gray-600">{tn.tenantName}</span>
                        </span>
                        <b className="shrink-0 text-lg tabular-nums">{skipped ? "—" : fmtMoney(round2(total))}</b>
                      </div>

                      {!skipped && bill && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {kinds.map((k) => {
                            const lines = bill.lines.filter((l) => l.kind === k);
                            if (!lines.length) return null;
                            const key = overrideKey(tn.contractId, k);
                            const fb = calc.final.bills.find((b) => b.contractId === tn.contractId && b.kind === k);
                            const all = round2(lines.reduce((s, l) => s + l.amount, 0));
                            const status = lines.every((l) => l.status === "EXEMPT") ? "EXEMPT" : lines.every((l) => l.status === "NOT_IN_CONTRACT") ? "NOT_IN_CONTRACT" : "BILL";
                            const overridden = key in calc.ov;
                            if (editing === key) {
                              return (
                                <span key={k} className="flex items-center gap-1 rounded-full bg-brand-light py-1 pl-3 pr-1 text-xs">
                                  {kindLabel(k)} RM
                                  <input
                                    autoFocus
                                    type="number"
                                    inputMode="decimal"
                                    min="0"
                                    defaultValue={overrides[key] ?? String(fb?.amount ?? 0)}
                                    onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                                    onBlur={(e) => {
                                      const v = e.target.value;
                                      setOverrides((s) => ({ ...s, [key]: v }));
                                      setEditing(null);
                                    }}
                                    className="h-8 w-20 rounded-lg border border-brand bg-white px-2 text-right text-base"
                                  />
                                </span>
                              );
                            }
                            return (
                              <button
                                key={k}
                                type="button"
                                onClick={() => isAdmin && setEditing(key)}
                                className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs ${overridden ? "bg-brand-light text-brand" : status === "BILL" ? "bg-gray-100 text-gray-700" : "bg-gray-50 text-gray-400"}`}
                              >
                                {kindLabel(k)}{" "}
                                {status === "BILL" || overridden ? <b className="font-semibold tabular-nums">{fmtMoney(fb?.amount ?? 0)}</b> : <s className="tabular-nums">{fmtMoney(all)}</s>}
                                {overridden && <span className="text-[10px]">{t("已改", "edited")}</span>}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {!skipped && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {kinds.map((k) =>
                            tn.exempt[k] ? (
                              <Pill key={`ex-${k}`} tone="teal">
                                {t(`豁免${KIND_LABELS[k].zh}`, `${KIND_LABELS[k].en} exempt`)}
                                {tn.exempt[k]!.until ? t(` 到 ${fmtDate(tn.exempt[k]!.until)}`, ` until ${fmtDate(tn.exempt[k]!.until)}`) : ""} · {tn.exempt[k]!.reason}
                              </Pill>
                            ) : !tn.pays[k] && bill?.lines.some((l) => l.kind === k) ? (
                              <Pill key={`nc-${k}`} tone="amber">
                                {t(`合同没包含${KIND_LABELS[k].zh}，公司承担`, `${KIND_LABELS[k].en} not in contract — company pays`)}
                              </Pill>
                            ) : null
                          )}
                          {!["ACTIVE", "EXPIRING"].includes(tn.status) && <Pill>{t("已搬走 / 已结束", "Moved out / ended")}</Pill>}
                          {Object.keys(calc.ov).some((k) => k.startsWith(`${tn.contractId}:`)) && (
                            <button
                              type="button"
                              onClick={() => setOverrides((s) => Object.fromEntries(Object.entries(s).filter(([k]) => !k.startsWith(`${tn.contractId}:`))))}
                              className="text-xs text-gray-500 underline"
                            >
                              {t("恢复系统算的金额", "Undo my changes")}
                            </button>
                          )}
                        </div>
                      )}

                      {isAdmin && (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {byPeople && !skipped && (
                            <span className="flex items-center gap-1 rounded-xl bg-gray-50 px-1 py-0.5 text-xs text-gray-600">
                              <button type="button" onClick={() => setOccupants(tn, tn.occupants - 1)} disabled={tn.occupants <= 1} aria-label={t("少一人", "One fewer")} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-white disabled:opacity-30">
                                <IconMinus size={15} />
                              </button>
                              {t(`${tn.occupants} 人`, `${tn.occupants} ${tn.occupants === 1 ? "person" : "people"}`)}
                              <button type="button" onClick={() => setOccupants(tn, tn.occupants + 1)} aria-label={t("多一人", "One more")} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-white">
                                <IconPlus size={15} />
                              </button>
                            </span>
                          )}
                          <button type="button" onClick={() => setExemptFor(tn.contractId)} className="rounded-xl bg-gray-50 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100">
                            {t("豁免", "Exemptions")}
                            {tn.exemptions.length > 0 ? ` (${tn.exemptions.length})` : ""}
                          </button>
                          <button
                            type="button"
                            onClick={() => setSkip((s) => (skipped ? s.filter((x) => x !== tn.contractId) : [...s, tn.contractId]))}
                            className="rounded-xl bg-gray-50 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100"
                          >
                            {skipped ? t("算回他", "Include") : t("这个月不算他", "Leave out this month")}
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="mt-3 grid grid-cols-2 gap-2 rounded-2xl bg-gray-50 p-3 text-sm">
              <div>
                <span className="block text-[11px] text-gray-500">{t("租客要付", "Tenants pay")}</span>
                <b className="text-base">{fmtMoney(calc.final.billed)}</b>
              </div>
              <div>
                <span className="block text-[11px] text-gray-500">{t("公司承担（豁免、空房、合同没包含）", "Company pays (exempt, empty, not in contract)")}</span>
                <b className="text-base">{fmtMoney(calc.final.company)}</b>
              </div>
            </div>
            {isAdmin && <p className="mt-2 text-xs text-gray-400">{t("点金额可以手动改；改成 0 就不开这一项。", "Tap an amount to change it; 0 leaves it out.")}</p>}
          </section>

          {/* ③ issue */}
          <section className={card}>
            <h2 className="mb-2 text-[15px] font-semibold text-gray-900">{t("③ 开账单并通知租客", "③ Issue and notify")}</h2>
            <label className="block">
              <span className="mb-1 block text-sm text-gray-600">{t("付款期限", "Pay by")}</span>
              <input type="date" value={dueDate} min={todayMY()} onChange={(e) => setDueDate(e.target.value)} className="input" />
            </label>
            <p className="mt-1 text-xs text-gray-500">{t("这类账单迟交不会自动罚款，过期后系统每 3 天提醒租客一次。", "These bills aren't fined automatically; tenants get a reminder every 3 days once overdue.")}</p>
            {calc.final.bills.length > 0 && (
              <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-[#e7f8ee] p-3 font-sans text-[13px] leading-relaxed text-gray-800">{preview}</pre>
            )}
            {isAdmin ? (
              <button
                type="button"
                onClick={issue}
                disabled={issuing || !calc.ready || calc.final.bills.length === 0 || !dueDate}
                className="btn-primary mt-3 flex w-full items-center justify-center gap-1.5 py-3"
              >
                <IconCheck size={18} />
                {issuing
                  ? t("开单中…", "Issuing…")
                  : !calc.ready
                    ? t("先填好全部读数", "Fill in every meter first")
                    : t(`开 ${calc.final.bills.length} 张账单并通知租客`, `Issue ${calc.final.bills.length} bills and notify`)}
              </button>
            ) : (
              <p className="mt-3 text-center text-xs text-gray-400">{t("只有 Admin 可以开单。", "Only Admin can issue bills.")}</p>
            )}
            <p className="mt-2 text-xs text-gray-400">{t("租客会在「我的账单」看到每一项是怎么算的，并收到 email。", "Tenants see how each amount was worked out in their bills and get an email.")}</p>
          </section>
        </div>
      )}

      {data && isAdmin && <MeterSetupSheet open={setupOpen} onClose={() => setSetupOpen(false)} data={data} onChanged={() => load(data.period, false)} />}
      {data && (
        <ExemptionSheet
          key={exemptFor ?? "none"}
          tenancy={exemptTenancy}
          kinds={kinds.length ? kinds : UTILITY_KINDS}
          period={data.period}
          onClose={() => setExemptFor(null)}
          onChanged={() => load(data.period, false)}
        />
      )}

      <Sheet open={!!issued} onClose={() => setIssued(null)} title={t("账单已开好", "Bills issued")}>
        {issued && (
          <>
            <p className="text-sm text-gray-700">{issued.message}</p>
            <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-[#e7f8ee] p-3 font-sans text-[13px] leading-relaxed text-gray-800">{issued.whatsapp}</pre>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => copy(issued.whatsapp)} className="btn-soft flex items-center justify-center gap-1.5 py-2.5">
                <IconCopy size={17} />
                {t("复制", "Copy")}
              </button>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(issued.whatsapp)}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-1.5 rounded-lg bg-[#25D366] py-2.5 text-sm font-semibold text-white hover:opacity-90"
              >
                <IconChat size={18} />
                WhatsApp
              </a>
            </div>
            <button type="button" onClick={() => setIssued(null)} className="mt-2 flex w-full items-center justify-center gap-1 py-2 text-sm text-gray-500">
              <IconX size={16} />
              {t("关闭", "Close")}
            </button>
          </>
        )}
      </Sheet>
    </div>
  );
}
