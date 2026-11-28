"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Breadcrumbs from "@/components/Breadcrumbs";
import Pill from "@/components/Pill";
import UnitNotes from "@/components/UnitNotes";
import { useLanguage } from "@/components/LanguageProvider";
import { IconChevronRight } from "@/components/icons";
import { fmtDate, fmtMoney } from "@/lib/format";
import { SIGN_STEP_LABELS, SIGN_STEP_TONE, type SignStep } from "@/lib/signStep";
import RoomsClient from "../../rooms/RoomsClient";
import ManageContracts from "../../contracts/ManageContracts";
import OutstandingBillsClient from "../../payments/outstanding/OutstandingBillsClient";
import ReviewQueueClient from "../../payments/review/ReviewQueueClient";
import UnitBillingClient from "../../utilities/[propertyCode]/UnitBillingClient";
import MaintenanceClient from "../../maintenance/MaintenanceClient";
import UnitDetailClient from "./UnitDetailClient";
import UnitInfoClient from "./UnitInfoClient";
import UnitReportClient from "./UnitReportClient";
import { tabsFor, type HubTab } from "./tabs";

type Overview = {
  property: { code: string; name: string; address: string | null; region: string | null; status: string | null; building: string | null; unitNo: string | null };
  rooms: { total: number; occupied: number; vacant: number; reserved: number; maintenance: number; carparks: number; vacantCodes: string[] };
  contracts: {
    active: number;
    signing: { code: string; roomCode: string; tenantName: string; step: SignStep | null; moveIn: string | null }[];
    ending: { code: string; roomCode: string; tenantName: string; end: string | null }[];
  };
  money: { unpaidCount: number; unpaidAmount: number; lateCount: number; lateAmount: number; reviewCount: number } | null;
  repairsOpen: number;
};

const todayMY = () => new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
const daysFrom = (today: string, day: string) => Math.round((Date.parse(day) - Date.parse(today)) / 86_400_000);
const CARD = "rounded-2xl bg-white shadow-[0_1px_2px_rgba(30,27,46,0.05)]";

/** One unit (楼盘), everything about it behind eight tabs: 概况 · 房间 · 合同 · 账单 · 水电 ·
 * 维修 · 资料 · 报表. The tab is kept in the address (?tab=…) so a link or a refresh lands on it. */
export default function PropertyHub({ propertyCode, role, initialTab, period }: { propertyCode: string; role: string; initialTab: HubTab; period: string | null }) {
  const { t } = useLanguage();
  const manager = role === "BOSS" || role === "ADMIN";
  const tabs = tabsFor(role);
  const [tab, setTab] = useState<HubTab>(initialTab);
  const [ov, setOv] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [today] = useState(todayMY);
  const tabBar = useRef<HTMLElement>(null);

  const loadOverview = useCallback(async () => {
    try {
      const res = await fetch(`/api/properties/${propertyCode}/overview`);
      const d = await res.json();
      if (d.success) {
        setOv(d);
        setError("");
      } else setError(d.message);
    } catch {
      setError(t("出错，请稍后再试", "Something went wrong — please try again later"));
    }
  }, [propertyCode, t]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- first load; state is set after the fetch resolves
    void loadOverview();
  }, [loadOverview]);

  // Opened straight on a tab far along the row (e.g. 报表): bring it into view.
  useEffect(() => {
    tabBar.current?.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [tab]);

  function go(next: HubTab) {
    setTab(next);
    window.history.replaceState(null, "", next === "overview" ? `/units/${propertyCode}` : `/units/${propertyCode}?tab=${next}`);
    if (next === "overview") void loadOverview();
  }

  const badge = (k: HubTab): { n: string; rose?: boolean } | null => {
    if (!ov) return null;
    if (k === "rooms") return { n: `${ov.rooms.occupied}/${ov.rooms.total}` };
    if (k === "contracts") return ov.contracts.signing.length ? { n: String(ov.contracts.signing.length), rose: true } : { n: String(ov.contracts.active) };
    if (k === "bills" && ov.money) return ov.money.lateCount ? { n: String(ov.money.lateCount), rose: true } : ov.money.unpaidCount ? { n: String(ov.money.unpaidCount) } : null;
    if (k === "repairs") return ov.repairsOpen ? { n: String(ov.repairsOpen) } : null;
    return null;
  };

  const p = ov?.property;
  const subline = p ? [p.building && p.building !== p.name ? p.building : null, p.unitNo, p.address].filter(Boolean).join(" · ") : "";

  return (
    <div className="app-type mx-auto max-w-6xl space-y-3">
      <Breadcrumbs items={[{ label: t("楼盘", "Properties"), href: "/units" }, { label: p?.name ?? propertyCode }]} />
      <div>
        <h1 className="text-lg font-semibold text-gray-900">
          {p?.name ?? propertyCode}
          <span className="ml-1.5 text-sm font-normal text-gray-400">{propertyCode}</span>
        </h1>
        {subline && <p className="truncate text-xs text-gray-500">{subline}</p>}
      </div>

      <nav ref={tabBar} aria-label={t("楼盘分页", "Property sections")} className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-1 [scrollbar-width:none] sm:-mx-5 sm:px-5 md:mx-0 md:flex-wrap md:px-0">
        {tabs.map((x) => {
          const on = x.key === tab;
          const b = badge(x.key);
          return (
            <button
              key={x.key}
              type="button"
              aria-current={on ? "page" : undefined}
              onClick={() => go(x.key)}
              className={`flex h-8 shrink-0 items-center gap-1 rounded-full px-3 text-[13px] font-medium transition-colors ${
                on ? "bg-brand text-white" : "bg-white text-gray-700 shadow-sm hover:bg-gray-50"
              }`}
            >
              {t(x.zh, x.en)}
              {b && <span className={`text-[11px] ${on ? "text-white/80" : b.rose ? "font-semibold text-rose-600" : "text-gray-400"}`}>{b.n}</span>}
            </button>
          );
        })}
      </nav>

      {error && <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      {tab === "overview" &&
        (ov ? (
          <OverviewTab ov={ov} today={today} propertyCode={propertyCode} onGo={go} />
        ) : (
          !error && <div className="h-40 animate-pulse rounded-2xl bg-white/80 motion-reduce:animate-none" />
        ))}
      {tab === "rooms" && <RoomsClient role={role} propertyCode={propertyCode} embedded />}
      {tab === "contracts" && <ManageContracts role={role} propertyCode={propertyCode} embedded />}
      {tab === "bills" && manager && <BillsTab propertyCode={propertyCode} canAct={role === "ADMIN"} counts={ov?.money ?? null} />}
      {tab === "utilities" && manager && <UnitBillingClient propertyCode={propertyCode} initialPeriod={period} openSetup={false} isAdmin={role === "ADMIN"} embedded />}
      {tab === "repairs" && manager && <MaintenanceClient canAct={role === "ADMIN"} propertyCode={propertyCode} />}
      {tab === "info" && manager && (
        <div className="space-y-3">
          <UnitDetailClient propertyCode={propertyCode} canEdit={role === "ADMIN"} onChanged={() => void loadOverview()} />
          <UnitInfoClient propertyCode={propertyCode} />
        </div>
      )}
      {tab === "report" && <UnitReportClient propertyCode={propertyCode} role={role} />}
    </div>
  );
}

/** 概况: how full it is, money waiting, repairs, what to keep in mind, and tenancies that need a
 * push (signatures) or a decision (ending within 60 days). Each number opens its tab. */
function OverviewTab({ ov, today, propertyCode, onGo }: { ov: Overview; today: string; propertyCode: string; onGo: (t: HubTab) => void }) {
  const { t } = useLanguage();
  const r = ov.rooms;
  const tiles: { l: string; v: string; sub: string; tone: string; go: HubTab }[] = [
    {
      l: t("已出租", "Let"),
      v: `${r.occupied} / ${r.total}`,
      sub: r.vacant ? t(`${r.vacant} 间空：${r.vacantCodes.join("、")}`, `${r.vacant} vacant: ${r.vacantCodes.join(", ")}`) : t("全部住满", "Fully let"),
      tone: r.vacant ? "text-amber-700" : "text-teal-700",
      go: "rooms",
    },
    {
      l: t("生效合同", "Active contracts"),
      v: String(ov.contracts.active),
      sub: ov.contracts.signing.length ? t(`${ov.contracts.signing.length} 份还没签好`, `${ov.contracts.signing.length} not signed yet`) : t("没有等签的", "None waiting to sign"),
      tone: ov.contracts.signing.length ? "text-rose-600" : "text-gray-400",
      go: "contracts",
    },
  ];
  if (ov.money) {
    tiles.push({
      l: t("未收", "Unpaid"),
      v: fmtMoney(ov.money.unpaidAmount),
      sub: ov.money.lateCount
        ? t(`逾期 ${ov.money.lateCount} 张 ${fmtMoney(ov.money.lateAmount)}`, `${ov.money.lateCount} overdue, ${fmtMoney(ov.money.lateAmount)}`)
        : ov.money.reviewCount
          ? t(`${ov.money.reviewCount} 张交易单待审核`, `${ov.money.reviewCount} slips to review`)
          : t(`${ov.money.unpaidCount} 张账单`, `${ov.money.unpaidCount} bills`),
      tone: ov.money.lateCount ? "text-rose-600" : ov.money.reviewCount ? "text-amber-700" : "text-gray-400",
      go: "bills",
    });
    tiles.push({
      l: t("报修中", "Open repairs"),
      v: String(ov.repairsOpen),
      sub: ov.repairsOpen ? t("点进去跟进", "Tap to follow up") : t("没有", "None"),
      tone: ov.repairsOpen ? "text-amber-700" : "text-gray-400",
      go: "repairs",
    });
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {tiles.map((x) => (
          <button key={x.l} type="button" onClick={() => onGo(x.go)} className={`${CARD} min-w-0 px-3 py-2.5 text-left hover:bg-gray-50`}>
            <span className="block text-[12px] text-gray-500">{x.l}</span>
            <span className="block truncate text-[19px] font-semibold tabular-nums leading-tight text-gray-900">{x.v}</span>
            <span className={`mt-0.5 block truncate text-[11.5px] ${x.tone}`}>{x.sub}</span>
          </button>
        ))}
      </div>

      <UnitNotes propertyCode={propertyCode} variant="full" />

      {ov.contracts.signing.length > 0 && (
        <section className={`${CARD} p-3.5`}>
          <h2 className="mb-1 text-[15px] font-semibold text-gray-900">
            {t("还没签好", "Not signed yet")} <span className="font-normal text-gray-400">{ov.contracts.signing.length}</span>
          </h2>
          <ul className="divide-y divide-gray-100">
            {ov.contracts.signing.map((c) => (
              <li key={c.code}>
                <Link href={`/contracts/${c.code}`} className="flex items-center gap-2 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] text-gray-900">
                      <b className="font-semibold">{c.roomCode}</b> {c.tenantName}
                    </span>
                    <span className="block text-[11.5px] text-gray-400">
                      {c.code}
                      {c.moveIn && t(` · 入住 ${fmtDate(c.moveIn)}`, ` · moves in ${fmtDate(c.moveIn)}`)}
                    </span>
                  </span>
                  {c.step && <Pill tone={SIGN_STEP_TONE[c.step]}>{t(SIGN_STEP_LABELS[c.step].zh, SIGN_STEP_LABELS[c.step].en)}</Pill>}
                  <IconChevronRight size={16} className="shrink-0 text-gray-300" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {ov.contracts.ending.length > 0 && (
        <section className={`${CARD} p-3.5`}>
          <h2 className="mb-1 text-[15px] font-semibold text-gray-900">
            {t("60 天内到期", "Ending within 60 days")} <span className="font-normal text-gray-400">{ov.contracts.ending.length}</span>
          </h2>
          <ul className="divide-y divide-gray-100">
            {ov.contracts.ending.map((c) => {
              const d = c.end ? daysFrom(today, c.end) : null;
              return (
                <li key={c.code}>
                  <Link href={`/contracts/${c.code}`} className="flex items-center gap-2 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] text-gray-900">
                        <b className="font-semibold">{c.roomCode}</b> {c.tenantName}
                      </span>
                      <span className="block text-[11.5px] text-gray-400">{c.code}</span>
                    </span>
                    {c.end && (
                      <span className="shrink-0 text-right text-[12px] leading-tight">
                        <span className="block text-gray-700">{fmtDate(c.end)}</span>
                        <span className={d !== null && d < 0 ? "font-medium text-rose-600" : d !== null && d <= 30 ? "font-medium text-amber-700" : "text-gray-400"}>
                          {d === null ? "" : d < 0 ? t(`过了 ${-d} 天`, `${-d}d ago`) : d === 0 ? t("今天", "today") : t(`还有 ${d} 天`, `in ${d}d`)}
                        </span>
                      </span>
                    )}
                    <IconChevronRight size={16} className="shrink-0 text-gray-300" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

/** 账单: this unit's unpaid bills, or its slips waiting to be checked. */
function BillsTab({ propertyCode, canAct, counts }: { propertyCode: string; canAct: boolean; counts: Overview["money"] }) {
  const { t } = useLanguage();
  // Every unpaid bill already has its slip in → open straight on the slips.
  const [view, setView] = useState<"unpaid" | "review">(counts && counts.reviewCount && counts.reviewCount === counts.unpaidCount ? "review" : "unpaid");
  return (
    <div className="space-y-3">
      <nav aria-label={t("账单", "Bills")} className="grid max-w-sm grid-cols-2 rounded-xl bg-gray-200/60 p-1 text-[13px] font-semibold">
        {(
          [
            ["unpaid", t("未清账单", "Unpaid"), counts?.unpaidCount],
            ["review", t("待审核", "To review"), counts?.reviewCount],
          ] as const
        ).map(([k, l, n]) => (
          <button
            key={k}
            type="button"
            aria-pressed={view === k}
            onClick={() => setView(k)}
            className={`flex h-8 items-center justify-center gap-1 rounded-lg ${view === k ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-800"}`}
          >
            {l}
            {n !== undefined && <span className="text-[12px] font-normal text-gray-400">{n}</span>}
          </button>
        ))}
      </nav>
      {view === "unpaid" ? <OutstandingBillsClient propertyCode={propertyCode} embedded /> : <ReviewQueueClient canAct={canAct} propertyCode={propertyCode} embedded />}
    </div>
  );
}
