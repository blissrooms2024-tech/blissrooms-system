"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/components/LanguageProvider";
import { IconBell } from "@/components/icons";
import { navMeta, TONE_CLASS } from "@/components/navMeta";
import Sheet from "@/components/Sheet";
import TenantWifiCard from "@/components/TenantWifiCard";
import { SupportList } from "@/components/SupportContact";
import { buildContractSteps } from "@/lib/contractSteps";
import { RULES } from "@/lib/config";
import QuickActions, { type Action } from "../dashboard/QuickActions";
import { Section, ListRow, rm } from "../dashboard/ui";

/** Tenant shortcuts — same customisable grid as the management home, tenant pages only. */
const TENANT_ACTIONS: Action[] = [
  { id: "bills", href: "/my-bills", meta: "/my-bills", zh: "付款 / 账单", en: "Pay / Bills" },
  { id: "maintenance", href: "/my-maintenance", meta: "/my-maintenance", zh: "报修", en: "Repairs" },
  { id: "tenancy", href: "/my-tenancy", meta: "/my-tenancy", zh: "我的租约", en: "My tenancy" },
  { id: "support", meta: "/support", zh: "联系客服", en: "Support" },
  { id: "guide", href: "/my-guide", meta: "/my-guide", zh: "入住指南", en: "Move-in guide" },
  { id: "aircon", href: "/my-aircon", meta: "/my-aircon", zh: "冷气", en: "Air-cond" },
  { id: "vouchers", href: "/my-vouchers", meta: "/my-vouchers", zh: "代金券", en: "Vouchers" },
  { id: "movein", href: "/my-movein", meta: "/my-movein", zh: "Move-in", en: "Move-in" },
  { id: "moveout", href: "/my-moveout", meta: "/my-moveout", zh: "Move-out", en: "Move-out" },
  { id: "warnings", href: "/my-warnings", meta: "/my-warnings", zh: "警告信", en: "Warnings" },
  { id: "profile", href: "/profile", meta: "/profile", zh: "我的资料", en: "My profile" },
];
const TENANT_DEFAULTS = ["bills", "maintenance", "tenancy", "support", "guide", "aircon", "vouchers", "moveout"];

interface Card {
  contractCode: string;
  roomCode: string;
  status: string;
  carparkRoomCode: string | null;
  outstanding: number;
  agentSigned: boolean;
  tenantSigned: boolean;
  isLegacy: boolean;
  isRenewal: boolean;
  hasICFront: boolean;
  hasICBack: boolean;
  moveInDone: boolean;
  unpaidBillCount: number;
  openMaintenanceCount: number;
  warningLetterCount: number;
  daysToExpiry: number | null;
  moveOutNoticeDate: string | null;
  renewalRequestedAt: string | null;
}

type Todo = { key: string; href: string; tone: "rose" | "amber"; text: string; sub?: string };

export default function TenantHomeClient({ name, userCode, hour, today }: { name: string; userCode: string; hour: number; today: string }) {
  const { t, locale } = useLanguage();
  const [cards, setCards] = useState<Card[] | null>(null);
  const [supportOpen, setSupportOpen] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/contracts/my-cards");
    const data = await res.json().catch(() => null);
    setCards(data?.success ? data.cards : []);
  }, []);

  useEffect(() => {
    // setState happens after the fetch's await, not synchronously in the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  // Only contracts that are live or on their way in matter on the home page.
  const live = (cards ?? []).filter((c) => !["TERMINATED", "MOVED_OUT", "RENEWED", "EXPIRED"].includes(c.status));
  const outstanding = live.reduce((n, c) => n + c.outstanding, 0);
  const unpaid = live.reduce((n, c) => n + c.unpaidBillCount, 0);
  const repairs = live.reduce((n, c) => n + c.openMaintenanceCount, 0);
  const warnings = live.reduce((n, c) => n + c.warningLetterCount, 0);
  const main = live.find((c) => c.status === "ACTIVE") ?? live[0] ?? null;

  // 待办: the next step that's on the tenant for each contract, plus bills/repairs/expiry.
  const todos: Todo[] = [];
  for (const c of live) {
    const icDone = c.hasICFront && c.hasICBack;
    const flow = buildContractSteps(
      {
        status: c.status,
        agentSigned: c.agentSigned,
        tenantSigned: c.tenantSigned,
        icDone,
        moveInDone: c.moveInDone,
        outstanding: c.outstanding,
        isLegacy: c.isLegacy,
        isRenewal: c.isRenewal,
      },
      t
    );
    if (flow.nextAction?.who === "Tenant") {
      todos.push({ key: `step-${c.contractCode}`, href: "/my-tenancy", tone: "rose", text: flow.nextAction.text, sub: `${c.contractCode} · ${c.roomCode}` });
    }
    const noticeDays = RULES.NOTICE_MONTHS * 30;
    if (c.status === "ACTIVE" && c.daysToExpiry !== null && c.daysToExpiry <= noticeDays && !c.moveOutNoticeDate && !c.renewalRequestedAt) {
      todos.push({
        key: `expiry-${c.contractCode}`,
        href: "/my-tenancy",
        tone: "amber",
        text: t(`租约还剩 ${c.daysToExpiry} 天到期，请选续约或搬出`, `Lease ends in ${c.daysToExpiry} days — choose to renew or move out`),
        sub: `${c.contractCode} · ${c.roomCode}`,
      });
    }
  }
  if (unpaid > 0) {
    todos.push({ key: "bills", href: "/my-bills", tone: "rose", text: t(`有 ${unpaid} 张账单未付`, `${unpaid} unpaid bill(s)`), sub: outstanding > 0 ? rm(outstanding) : undefined });
  }
  if (warnings > 0) {
    todos.push({ key: "warnings", href: "/my-warnings", tone: "amber", text: t(`有 ${warnings} 封警告信`, `${warnings} warning letter(s)`) });
  }

  const greeting = hour >= 5 && hour < 12 ? t("早上好", "Good morning") : hour >= 12 && hour < 18 ? t("下午好", "Good afternoon") : t("晚上好", "Good evening");
  const [y, m, d] = today.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const dateLine =
    locale === "en"
      ? `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][weekday]}, ${d} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1]} ${y}`
      : `${y}年${m}月${d}日 星期${"日一二三四五六"[weekday]}`;

  const modules = [
    {
      href: "/my-bills",
      l: t("账单", "Bills"),
      status: unpaid ? t(`${unpaid} 张未付`, `${unpaid} unpaid`) : t("已付清", "All paid"),
      alert: unpaid ? "rose" : null,
    },
    {
      href: "/my-maintenance",
      l: t("报修", "Repairs"),
      status: repairs ? t(`${repairs} 项处理中`, `${repairs} open`) : t("没有", "None"),
      alert: repairs ? "amber" : null,
    },
    {
      href: "/my-tenancy",
      l: t("租约", "Tenancy"),
      status: main
        ? main.daysToExpiry !== null && main.status === "ACTIVE"
          ? t(`剩 ${Math.max(main.daysToExpiry, 0)} 天`, `${Math.max(main.daysToExpiry, 0)} days left`)
          : main.agentSigned && !main.tenantSigned
            ? t("待你签名", "Sign now")
            : t("办理中", "In progress")
        : "-",
      alert: main && main.agentSigned && !main.tenantSigned && !main.isLegacy ? "rose" : null,
    },
    { href: "/my-guide", l: t("入住指南", "Guide"), status: t("须知", "House info"), alert: null },
  ] as const;

  return (
    <div className="app-type mx-auto max-w-3xl pb-20 md:pb-8">
      {/* Hero — same brand header as the management home */}
      <div className="relative -mx-3 -mt-3 overflow-hidden rounded-b-[28px] bg-brand px-5 pb-16 pt-3 text-white sm:-mx-5 sm:-mt-5 sm:px-6 md:mx-0 md:mt-0 md:rounded-[28px] md:pb-20 md:pt-6">
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[15px] font-medium">
              {greeting}
              {t("，", ", ")}
              {name}
            </p>
            <p className="text-xs text-white/65">{dateLine}</p>
          </div>
          <button
            type="button"
            onClick={() => document.getElementById("tenant-todo")?.scrollIntoView({ behavior: "smooth" })}
            aria-label={t(`待办 ${todos.length} 项`, `${todos.length} to-dos`)}
            className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/15 hover:bg-white/25"
          >
            <IconBell size={21} />
            {todos.length > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[11px] font-bold ring-2 ring-brand">
                {todos.length}
              </span>
            )}
          </button>
        </div>

        <div className="relative mt-6">
          <p className="text-xs text-white/70">{outstanding > 0 ? t("还欠总额", "Total outstanding") : t("账单状态", "Bills")}</p>
          <div className="mt-1 flex items-end gap-4">
            <span className="text-[44px] font-semibold leading-[0.9] tracking-[-0.02em]">{outstanding > 0 ? rm(outstanding) : t("已付清", "All paid")}</span>
          </div>
          {main && (
            <p className="mt-3 text-[13px] text-white/85">
              🏠 {main.roomCode}
              {main.carparkRoomCode ? ` · 🚗 ${main.carparkRoomCode}` : ""} · <span className="text-white/70">{main.contractCode}</span>
            </p>
          )}
          {cards !== null && live.length === 0 && <p className="mt-3 text-[13px] text-white/85">{t("目前没有生效中的租约", "No active tenancy right now")}</p>}
        </div>
      </div>

      {/* Main areas, overlapping the hero */}
      <nav
        aria-label={t("主要功能", "Main areas")}
        className="relative z-10 mx-1 -mt-11 grid grid-cols-4 rounded-[22px] bg-white px-1 py-3 shadow-[0_2px_4px_rgba(30,27,46,0.04),0_18px_36px_-18px_rgba(76,29,149,0.35)] sm:mx-3 md:-mt-12 md:mx-6"
      >
        {modules.map((mod) => {
          const meta = navMeta(mod.href);
          return (
            <Link key={mod.href} href={mod.href} className="flex min-w-0 flex-col items-center gap-1 rounded-2xl px-0.5 py-1 hover:bg-gray-50">
              <span className={`grid h-11 w-11 place-items-center rounded-2xl ${TONE_CLASS[meta.tone]}`}>
                <meta.icon size={22} />
              </span>
              <span className="max-w-full truncate text-[13px] font-medium text-gray-800">{mod.l}</span>
              <span
                className={`max-w-full truncate text-[11px] ${mod.alert === "rose" ? "font-medium text-rose-600" : mod.alert === "amber" ? "font-medium text-amber-700" : "text-gray-400"}`}
              >
                {cards === null ? "…" : mod.status}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-5 space-y-4 px-0.5 sm:px-3 md:px-6">
        <QuickActions
          role="TENANT"
          userKey={userCode}
          badges={{ bills: unpaid, maintenance: repairs, warnings }}
          actions={TENANT_ACTIONS}
          defaultIds={TENANT_DEFAULTS}
          onAction={(id) => id === "support" && setSupportOpen(true)}
        />

        <Section id="tenant-todo" title={t("待办", "To-do")}>
          {cards === null ? (
            <div className="py-2 text-sm text-gray-400">{t("载入中...", "Loading...")}</div>
          ) : todos.length === 0 ? (
            <div className="py-2 text-sm text-gray-500">✅ {t("没有要你处理的事项", "Nothing needs your attention")}</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {todos.map((td) => (
                <ListRow key={td.key} href={td.href} right={<span className={`h-2.5 w-2.5 rounded-full ${td.tone === "rose" ? "bg-rose-500" : "bg-amber-400"}`} />}>
                  <span className="block text-gray-900">{td.text}</span>
                  {td.sub && <span className="block text-xs text-gray-500">{td.sub}</span>}
                </ListRow>
              ))}
            </div>
          )}
        </Section>

        <TenantWifiCard />

        <Section title={t("联系客服", "Contact support")}>
          <SupportList compact />
        </Section>
      </div>

      <Sheet open={supportOpen} onClose={() => setSupportOpen(false)} title={t("联系客服", "Contact support")}>
        <SupportList />
      </Sheet>
    </div>
  );
}
