"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import Pill, { type PillTone } from "@/components/Pill";
import Sheet from "@/components/Sheet";
import { useLanguage } from "@/components/LanguageProvider";
import { useToast } from "@/components/Toast";
import { IconChat, IconChevronRight, IconFolder, IconPlus, IconRefresh, IconSearch, IconSliders, IconUpload, IconUsers, IconX } from "@/components/icons";
import type { NavIcon } from "@/components/navMeta";
import { COMPANY, contractStatusLabel, contractStatusTone } from "@/lib/config";
import { fmtDate, fmtMoney } from "@/lib/format";
import { waNumber } from "@/lib/quote";
import { SIGN_STEP_LABELS, SIGN_STEP_TONE, signStepOf } from "@/lib/signStep";
import ContractActions from "./ContractActions";
import { ContractsTable, NOT_SIGNED_STATUSES, type Contract } from "./ContractsClient";

/**
 * Boss/Admin contract list. Phones get one card per contract — room and tenant first, what's
 * owed, where it's stuck, and its actions within thumb reach — instead of a ten-column table
 * that had to be scrolled sideways. Wider screens keep the table. (Agents still use
 * ContractsClient until their own pages are redesigned.)
 */

type Row = Contract & { contactNumber?: string | null; icFront?: string | null; icBack?: string | null };

type FilterKey = "" | "OUTSTANDING" | "RENT_ESCALATED" | "EXPIRING_SOON" | "NOT_SIGNED" | "CREDIT_BALANCE" | "RENEWAL" | "LEGACY_IMPORT";
const FILTERS: { key: FilterKey; zh: string; en: string; test: (c: Row) => boolean }[] = [
  { key: "", zh: "全部", en: "All", test: () => true },
  { key: "OUTSTANDING", zh: "有欠款", en: "Owing", test: (c) => c._outstanding > 0 },
  { key: "RENT_ESCALATED", zh: "租金逾期超10天", en: "Rent 10+ days late", test: (c) => !!c._rentEscalated },
  { key: "EXPIRING_SOON", zh: "快到期", en: "Ending soon", test: (c) => !!c._expiringSoon },
  { key: "NOT_SIGNED", zh: "还没签好", en: "Not signed yet", test: (c) => NOT_SIGNED_STATUSES.includes(c.status) },
  { key: "CREDIT_BALANCE", zh: "有预付余额", en: "Prepaid credit", test: (c) => c._creditBalance > 0 },
  { key: "RENEWAL", zh: "续约合同", en: "Renewals", test: (c) => !!c.renewedFromContractId },
  { key: "LEGACY_IMPORT", zh: "旧合同导入", en: "Legacy imports", test: (c) => !!c.remarks?.includes("旧合同导入") },
];

const PHONE_QUERY = "(max-width: 767px)";
function useIsPhone() {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(PHONE_QUERY);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(PHONE_QUERY).matches,
    () => false
  );
}

const todayMY = () => new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
const daysFromToday = (iso: string) => Math.round((Date.parse(iso.slice(0, 10)) - Date.parse(todayMY())) / 86_400_000);

/** `propertyCode` + `embedded`: the 合同 tab on a unit's page — only that unit's contracts, without
 * the page title, tools and 楼盘 picker. */
export default function ManageContracts({ role, propertyCode, embedded = false }: { role: string; propertyCode?: string; embedded?: boolean }) {
  const { t, locale } = useLanguage();
  const toast = useToast();
  const isPhone = useIsPhone();
  const isAdmin = role === "ADMIN";
  const [contracts, setContracts] = useState<Row[] | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("");
  /** 楼盘 picked on the stand-alone page ("" = all); fixed to the unit when embedded. */
  const [unit, setUnit] = useState(propertyCode ?? "");
  const [showExpired, setShowExpired] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [busyTool, setBusyTool] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/contracts/page-data");
      let data;
      try {
        data = await res.json();
      } catch {
        setError(t(`服务器出错 (HTTP ${res.status})，请稍后再试`, `Server error (HTTP ${res.status}) — please try again later`));
        return;
      }
      if (!data.success) return setError(data.message);
      setError("");
      setContracts(data.contracts);
    } catch {
      setError(t("网络连接失败，请检查网络后重试", "Network connection failed — please check your connection and try again"));
    }
  }, [t]);

  useEffect(() => {
    // Every setState in load() happens after the fetch's await, not synchronously in the effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function runTool(key: string, url: string) {
    setBusyTool(key);
    try {
      const res = await fetch(url, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        load();
      } else toast.danger(data.message);
    } catch {
      toast.danger(t("网络连接失败，请检查网络后重试", "Network connection failed — please check your connection and try again"));
    } finally {
      setBusyTool(null);
    }
  }

  // Everything below works on the picked 楼盘's contracts only.
  const scoped = useMemo(() => (contracts ?? []).filter((c) => !unit || c.room?.propertyCode === unit), [contracts, unit]);
  const units = useMemo(() => {
    const m = new Map<string, { name: string; n: number }>();
    for (const c of contracts ?? []) {
      const code = c.room?.propertyCode;
      if (!code || c._expired) continue;
      const u = m.get(code) ?? { name: c.room?.propertyName ?? code, n: 0 };
      u.n++;
      m.set(code, u);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [contracts]);

  const counts = useMemo(() => {
    const out: Partial<Record<FilterKey, number>> = {};
    for (const f of FILTERS) out[f.key] = scoped.filter(f.test).length;
    return out;
  }, [scoped]);

  const q = search.trim().toLowerCase();
  const active = FILTERS.find((f) => f.key === filter)!;
  const matched = scoped
    .filter((c) => active.test(c))
    .filter(
      (c) =>
        !q ||
        c.contractCode.toLowerCase().includes(q) ||
        (c.room?.roomCode ?? "").toLowerCase().includes(q) ||
        c.tenantName.toLowerCase().includes(q) ||
        c.agentName.toLowerCase().includes(q) ||
        (c.contactNumber ?? "").replace(/\D/g, "").includes(q.replace(/\D/g, "") || "\u0000")
    )
    .sort((a, b) => (filter === "LEGACY_IMPORT" ? (a.room?.roomCode ?? "").localeCompare(b.room?.roomCode ?? "") : 0));
  // Leases already past their end date (not yet renewed or moved out) sit in their own
  // folded section so they don't bury the contracts that still need attention.
  const live = matched.filter((c) => !c._expired);
  const expired = matched.filter((c) => c._expired);
  const liveTotal = scoped.filter((c) => !c._expired).length;

  const tools: { key: string; icon: NavIcon; zh: string; en: string; descZh?: string; descEn?: string; href?: string; run?: string }[] = [
    { key: "renewal", icon: IconRefresh, zh: "续约管理", en: "Renewals", href: "/contracts/renewal" },
    { key: "import", icon: IconUpload, zh: "导入旧合同", en: "Import legacy contracts", href: "/contracts/import" },
    { key: "dupes", icon: IconSearch, zh: "重复账单检查", en: "Duplicate bill check", href: "/contracts/duplicate-check" },
    {
      key: "prorata",
      icon: IconFolder,
      zh: "补回 Pro-rata 记录",
      en: "Backfill pro-rata",
      descZh: "让旧合同的 PDF 也显示 Pro-rata，可重复执行",
      descEn: "Shows pro-rata on older agreement PDFs; safe to rerun",
      run: "/api/contracts/backfill-prorata-amount",
    },
    {
      key: "company",
      icon: IconUsers,
      zh: "补正公司 Agent 合同",
      en: "Backfill company agent",
      descZh: "Admin 直接开的旧合同改用公司名字，解除卡住的签名",
      descEn: "Older Admin-opened contracts take the company name; unblocks stuck signatures",
      run: "/api/contracts/backfill-company-agent",
    },
  ];

  const list = (rows: Row[], empty: string) =>
    isPhone ? (
      rows.length === 0 ? (
        <p className="rounded-[20px] bg-white px-4 py-8 text-center text-sm text-gray-400">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((c) => (
            <ContractCard key={c.contractCode} c={c} role={role} onChanged={load} />
          ))}
        </ul>
      )
    ) : (
      <ContractsTable contracts={rows} role={role} locale={locale} t={t} onChanged={load} emptyMessage={empty} />
    );

  const emptyText = q || filter ? t("没有符合条件的合同", "No contracts match") : t("还没有合同", "No contracts yet");

  return (
    <div className="app-type mx-auto max-w-6xl space-y-3">
      {!embedded && (
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-semibold text-gray-900">
          {t("合同", "Contracts")}
          {contracts && <span className="ml-1.5 text-sm font-normal text-gray-400">{liveTotal}</span>}
        </h1>
        <div className="flex items-center gap-2">
          {isAdmin && isPhone && (
            <button
              type="button"
              onClick={() => setToolsOpen(true)}
              aria-label={t("合同工具", "Contract tools")}
              className="grid h-9 w-9 place-items-center rounded-xl bg-white text-gray-700 shadow-sm hover:bg-gray-50"
            >
              <IconSliders size={17} />
            </button>
          )}
          {isAdmin && (
            <Link href="/contracts/new" className="flex h-9 items-center gap-1 rounded-xl bg-brand px-3 text-[13px] font-semibold text-white hover:bg-brand-dark">
              <IconPlus size={16} />
              {t("新合同", "New")}
            </Link>
          )}
        </div>
      </div>
      )}

      {isAdmin && !isPhone && !embedded && (
        <div className="flex flex-wrap gap-2">
          {tools.map((tool) =>
            tool.href ? (
              <Link key={tool.key} href={tool.href} className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-sm text-gray-700 shadow-sm hover:bg-gray-50">
                <tool.icon size={16} className="text-gray-400" />
                {t(tool.zh, tool.en)}
              </Link>
            ) : (
              <button
                key={tool.key}
                type="button"
                disabled={busyTool !== null}
                onClick={() => runTool(tool.key, tool.run!)}
                title={tool.descZh ? t(tool.descZh, tool.descEn!) : undefined}
                className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-sm text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
              >
                <tool.icon size={16} className="text-gray-400" />
                {busyTool === tool.key ? t("处理中...", "Working...") : t(tool.zh, tool.en)}
              </button>
            )
          )}
        </div>
      )}

      <div className="flex gap-2 md:max-w-xl">
      <div className="relative min-w-0 flex-1">
        <IconSearch size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={embedded ? t("搜房间 / 租客 / 合同号", "Room, tenant, contract #") : t("搜房间 / 租客 / 合同号 / 电话", "Room, tenant, contract #, phone")}
          className="h-10 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-10 text-base shadow-sm placeholder:text-gray-400 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10 sm:text-sm"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            aria-label={t("清除搜索", "Clear search")}
            className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-gray-400 hover:bg-gray-100"
          >
            <IconX size={16} />
          </button>
        )}
      </div>
      {!embedded && units.length > 1 && (
        <select
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          aria-label={t("楼盘", "Property")}
          className={`h-10 w-[7.5rem] shrink-0 rounded-xl border bg-white px-2.5 text-base shadow-sm focus:border-brand focus:outline-none sm:w-44 sm:text-sm ${
            unit ? "border-brand font-semibold text-brand" : "border-gray-200 text-gray-700"
          }`}
        >
          <option value="">{t("全部楼盘", "All properties")}</option>
          {units.map(([code, u]) => (
            <option key={code} value={code}>
              {code} · {u.name} ({u.n})
            </option>
          ))}
        </select>
      )}
      </div>

      {/* Only the filters that currently have something in them, so the row stays short. */}
      <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] sm:-mx-5 sm:px-5 md:mx-0 md:flex-wrap md:px-0">
        {FILTERS.filter((f) => f.key === "" || f.key === filter || (counts[f.key] ?? 0) > 0).map((f) => {
          const on = f.key === filter;
          return (
            <button
              key={f.key || "all"}
              type="button"
              aria-pressed={on}
              onClick={() => setFilter(f.key)}
              className={`flex h-8 shrink-0 items-center gap-1 rounded-full px-3 text-[13px] font-medium transition-colors ${
                on ? "bg-brand text-white" : "bg-white text-gray-700 shadow-sm hover:bg-gray-50"
              }`}
            >
              {t(f.zh, f.en)}
              <span className={`text-[11px] ${on ? "text-white/80" : "text-gray-400"}`}>{counts[f.key] ?? 0}</span>
            </button>
          );
        })}
      </div>

      {error && (
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <span>{error}</span>
          <button type="button" onClick={load} className="shrink-0 font-semibold underline">
            {t("再试一次", "Try again")}
          </button>
        </div>
      )}

      {!contracts && !error && (
        <ul className="space-y-3" aria-label={t("载入中", "Loading")}>
          {[0, 1, 2].map((i) => (
            <li key={i} className="h-24 animate-pulse rounded-2xl bg-white/80 motion-reduce:animate-none" />
          ))}
        </ul>
      )}

      {contracts && (
        <>
          {live.length !== liveTotal && <p className="px-1 text-xs text-gray-500">{t(`显示 ${live.length} 份（共 ${liveTotal} 份）`, `${live.length} of ${liveTotal} shown`)}</p>}
          {isPhone ? list(live, emptyText) : <div className="rounded-[20px] bg-white p-4 shadow-sm">{list(live, emptyText)}</div>}

          {expired.length > 0 && (
            <section className="rounded-[20px] bg-white p-4 shadow-sm">
              <button type="button" onClick={() => setShowExpired((v) => !v)} aria-expanded={showExpired} className="flex w-full items-center justify-between gap-2 text-left">
                <span className="text-[15px] font-semibold text-gray-700">
                  {t("已过期合同", "Expired contracts")} <span className="font-normal text-gray-400">{expired.length}</span>
                </span>
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  {showExpired ? t("收起", "Hide") : t("展开", "Show")}
                  <IconChevronRight size={15} className={`transition-transform ${showExpired ? "rotate-90" : ""}`} />
                </span>
              </button>
              <p className="mt-0.5 text-xs text-gray-400">{t("到期了但还没续约或搬走", "Past their end date, not yet renewed or moved out")}</p>
              {showExpired && <div className="mt-3">{list(expired, t("没有符合条件的合同", "No contracts match"))}</div>}
            </section>
          )}
        </>
      )}

      <Sheet open={toolsOpen} onClose={() => setToolsOpen(false)} title={t("合同工具", "Contract tools")}>
        <ul className="-mx-2">
          {tools.map((tool) => {
            const body = (
              <>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gray-100 text-gray-600">
                  <tool.icon size={19} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-gray-900">{busyTool === tool.key ? t("处理中...", "Working...") : t(tool.zh, tool.en)}</span>
                  {tool.descZh && <span className="block text-xs text-gray-500">{t(tool.descZh, tool.descEn!)}</span>}
                </span>
                <IconChevronRight size={16} className="shrink-0 text-gray-300" />
              </>
            );
            const cls = "flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left hover:bg-gray-50 disabled:opacity-50";
            return (
              <li key={tool.key}>
                {tool.href ? (
                  <Link href={tool.href} className={cls} onClick={() => setToolsOpen(false)}>
                    {body}
                  </Link>
                ) : (
                  <button type="button" className={cls} disabled={busyTool !== null} onClick={() => runTool(tool.key, tool.run!)}>
                    {body}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </Sheet>
    </div>
  );
}

function ContractCard({ c, role, onChanged }: { c: Row; role: string; onChanged: () => void }) {
  const { t, locale } = useLanguage();
  const step = signStepOf(c);
  const status: { l: string; tone: PillTone } = c._expired
    ? { l: t("已过期", "Expired"), tone: "rose" }
    : step
      ? { l: t(SIGN_STEP_LABELS[step].zh, SIGN_STEP_LABELS[step].en), tone: SIGN_STEP_TONE[step] }
      : { l: contractStatusLabel(c.status, locale), tone: contractStatusTone(c.status) };
  const wa = waNumber(c.contactNumber);
  const days = c.expiredDate ? daysFromToday(c.expiredDate) : null;
  const owing = c._outstanding > 0;
  const agent = c.agentName === COMPANY.NAME ? t("公司续约", "Company renewal") : c.agentName;
  const legacy = c.remarks?.includes("旧合同导入");
  const flags = c._rentEscalated || c._creditBalance > 0;

  // Compact on purpose — three short lines and one row of small buttons — so a phone screen
  // shows several contracts at once.
  return (
    <li className="rounded-2xl bg-white px-3 py-2.5 shadow-[0_1px_2px_rgba(30,27,46,0.05)]">
      <Link href={`/contracts/${c.contractCode}`} className="block">
        <div className="flex items-center justify-between gap-2">
          <p className="flex min-w-0 items-baseline gap-1.5">
            <b className="shrink-0 text-[15px] font-semibold text-gray-900">{c.room?.roomCode ?? "—"}</b>
            <span className="truncate text-[13px] text-gray-700">{c.tenantName}</span>
          </p>
          <Pill tone={status.tone}>{status.l}</Pill>
        </div>
        <p className="mt-0.5 truncate text-[11.5px] text-gray-400">
          {c.contractCode} · {agent}
          {c.renewedFromContractId && c.agentName !== COMPANY.NAME ? t(" · 续约", " · renewal") : ""}
          {legacy ? t(" · 旧合同", " · legacy") : ""}
          {c.expiredDate && (
            <>
              {" · "}
              {t("到期", "ends")} {fmtDate(c.expiredDate)}
              {days !== null && (c._expiringSoon || c._expired) && (
                <span className={c._expired ? "text-rose-600" : "text-amber-700"}>
                  {" "}
                  {days < 0 ? t(`（过了 ${-days} 天）`, `(${-days}d ago)`) : t(`（还有 ${days} 天）`, `(in ${days}d)`)}
                </span>
              )}
            </>
          )}
        </p>
        {flags && (
          <div className="mt-1 flex flex-wrap gap-1">
            {c._rentEscalated && <Pill tone="rose">{t("租金逾期超10天", "Rent 10+ days late")}</Pill>}
            {c._creditBalance > 0 && <Pill tone="teal">{t(`预付 ${fmtMoney(c._creditBalance)}`, `${fmtMoney(c._creditBalance)} prepaid`)}</Pill>}
          </div>
        )}
      </Link>

      <div className="mt-1.5 flex items-center justify-between gap-2">
        {/* The amount never wraps; the small line under it gives way first when space is short. */}
        <Link href={`/contracts/${c.contractCode}`} className="min-w-0 leading-tight">
          <span className={`block whitespace-nowrap text-[14px] font-semibold tabular-nums ${owing ? "text-rose-600" : "text-teal-700"}`}>
            {owing ? fmtMoney(c._outstanding) : t("已付清", "Paid up")}
          </span>
          <span className="block truncate text-[11px] tabular-nums text-gray-400">
            {owing ? t("还欠 · ", "owing · ") : ""}
            {t("已收", "paid")} {fmtMoney(c._paid)} / {fmtMoney(c._due)}
          </span>
        </Link>
        <ContractActions
          contract={c}
          role={role}
          onChanged={onChanged}
          variant="card"
          extra={
            wa ? (
              <a
                href={`https://wa.me/${wa}`}
                target="_blank"
                rel="noreferrer"
                aria-label={t(`WhatsApp ${c.tenantName}`, `WhatsApp ${c.tenantName}`)}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#25D366]/12 text-[#128C7E] hover:bg-[#25D366]/20"
              >
                <IconChat size={17} />
              </a>
            ) : null
          }
        />
      </div>
    </li>
  );
}
