"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { useLanguage } from "@/components/LanguageProvider";
import {
  IconAlert,
  IconBed,
  IconBolt,
  IconCar,
  IconCash,
  IconCheck,
  IconChevronRight,
  IconContract,
  IconDoorIn,
  IconHourglass,
  IconReceipt,
  IconReceiptCheck,
  IconUsers,
  IconWallet,
} from "@/components/icons";
import { navMeta, TONE_CLASS, type NavIcon, type Tone } from "@/components/navMeta";
import { fmtDate, fmtMoney } from "@/lib/format";
import { COMPANY, contractStatusLabel, maintenanceStatusLabel, ROLE_LABELS } from "@/lib/config";
import { label, UTILITY_TYPE_LABELS } from "@/lib/unitInfo";
import type { DashboardData } from "@/lib/dashboard";
import { SIGN_STEP_LABELS, type SignStep } from "@/lib/signStep";
import type { QuoteOptions } from "@/lib/quoteOptions";
import QuickQuote from "./QuickQuote";
import ReportsCard from "./ReportsCard";
import HomeHero from "./HomeHero";
import QuickActions from "./QuickActions";
import CollectionCard from "./CollectionCard";
import FabMenu from "./FabMenu";
import { ListRow, MoreLink, Pill, rm, Section } from "./ui";

type Bill = DashboardData["todo"]["bills"][number];

const openQuote = () => window.dispatchEvent(new Event("open-quick-quote"));

/** Activity times are shown in Malaysia time on both the server and the phone, so the
 * first render and the hydrated one agree whatever timezone the server runs in. */
const myClock = (iso: string) => {
  const s = new Date(new Date(iso).getTime() + 8 * 3600_000).toISOString();
  return { day: s.slice(0, 10), hm: s.slice(11, 16) };
};

function Tile({
  href,
  icon: Icon,
  tone,
  value,
  label: text,
  sub,
  children,
}: {
  href: string;
  icon: NavIcon;
  tone: Tone;
  value: ReactNode;
  label: string;
  sub?: ReactNode;
  children?: ReactNode;
}) {
  const body = (
    <>
      <span className="flex items-center justify-between">
        <span className={`grid h-8 w-8 place-items-center rounded-xl ${TONE_CLASS[tone]}`}>
          <Icon size={18} />
        </span>
        <IconChevronRight size={16} className="text-gray-300" />
      </span>
      <span className="mt-2.5 block truncate text-[26px] font-semibold leading-none text-gray-900">{value}</span>
      <span className="mt-1.5 block text-xs font-medium text-gray-700">{text}</span>
      {sub && <span className="mt-0.5 block truncate text-[11px] text-gray-400">{sub}</span>}
      {children}
    </>
  );
  const cls = "block min-w-0 rounded-[18px] bg-white p-3.5 shadow-[0_1px_2px_rgba(30,27,46,0.04),0_12px_28px_-18px_rgba(76,29,149,0.22)] hover:bg-gray-50";
  // In-page anchors use a plain link so the browser jumps (instantly) to the list below.
  return href.startsWith("#") ? (
    <a href={href} className={cls}>
      {body}
    </a>
  ) : (
    <Link href={href} className={cls}>
      {body}
    </Link>
  );
}

export default function DashboardClient({
  data,
  quoteOptions,
  role,
  name,
  userCode,
  hour,
}: {
  data: DashboardData;
  quoteOptions: QuoteOptions;
  role: string;
  name: string;
  userCode: string;
  hour: number;
}) {
  const { t, locale } = useLanguage();
  const router = useRouter();
  const toast = useToast();
  const isAdmin = role === "ADMIN";
  const [paying, setPaying] = useState<Bill | null>(null);
  const [payForm, setPayForm] = useState({ amount: "", paidDate: data.today, book: true });
  const [saving, setSaving] = useState(false);

  const { reports, rooms, todo, claims, activity, signing, collection, maintenanceStatus, outstanding } = data;

  const relDay = (days: number) =>
    days === 0 ? t("今天", "today") : days === 1 ? t("明天", "tomorrow") : days > 0 ? t(`${days} 天后`, `in ${days} days`) : t(`已过 ${-days} 天`, `${-days} days ago`);

  const timeOf = (iso: string) => {
    const { day, hm } = myClock(iso);
    return day === data.today ? `${t("今天", "Today")} ${hm}` : `${fmtDate(day)} ${hm}`;
  };

  function openPay(b: Bill) {
    setPaying(b);
    setPayForm({ amount: b.amount !== null && b.kind === "UTILITY" ? String(b.amount) : "", paidDate: data.today, book: b.kind === "UTILITY" });
  }

  async function markPaid() {
    if (!paying) return;
    setSaving(true);
    try {
      const url =
        paying.kind === "UTILITY"
          ? `/api/properties/${paying.propertyCode}/info/utilities/${paying.id}/paid`
          : `/api/properties/${paying.propertyCode}/info/owner-rent`;
      const body =
        paying.kind === "UTILITY"
          ? { period: paying.period, amount: payForm.book ? payForm.amount : null, paidDate: payForm.paidDate }
          : { period: paying.period };
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await res.json();
      if (!d.success) return toast.danger(d.message);
      toast.success(d.message);
      setPaying(null);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const billLabel = (b: Bill) => (b.kind === "OWNER_RENT" ? t("屋主租金", "Owner rent") : label(UTILITY_TYPE_LABELS, b.utilityType ?? "OTHER", locale));

  const approvals: { n: number; l: string; href: string; icon: NavIcon; tone: Tone }[] = [
    { n: todo.pendingReview, l: t("交易单待审核", "Payment slips to review"), href: "/payments/review", icon: IconWallet, tone: "teal" as Tone },
    { n: todo.pendingApprove, l: t("合同待批准", "Contracts to approve"), href: "/contracts", icon: IconContract, tone: "violet" as Tone },
    ...(isAdmin ? [{ n: todo.pendingUsers, l: t("新用户待激活", "New users to activate"), href: "/users", icon: IconUsers, tone: "slate" as Tone }] : []),
    { n: claims.pending.count, l: t("报销待审批", "Claims to review"), href: "/claims", icon: IconReceiptCheck, tone: "teal" as Tone },
    { n: claims.toPay.count, l: t("报销待付款", "Claims to pay out"), href: "/claims", icon: IconCash, tone: "teal" as Tone },
    { n: todo.overdueBills.count, l: t(`租客逾期账单 · ${fmtMoney(todo.overdueBills.amount)}`, `Overdue tenant bills · ${fmtMoney(todo.overdueBills.amount)}`), href: "/payments/outstanding", icon: IconAlert, tone: "rose" as Tone },
    {
      n: todo.meterBilling.units.length,
      l: t(
        `${Number(todo.meterBilling.period.slice(5))}月还没抄表开单 · ${todo.meterBilling.units.map((u) => u.propertyCode).join("、")}`,
        `${todo.meterBilling.period} meters not billed · ${todo.meterBilling.units.map((u) => u.propertyCode).join(", ")}`
      ),
      href: `/utilities?period=${todo.meterBilling.period}`,
      icon: IconBolt,
      tone: "amber" as Tone,
    },
  ].filter((a) => a.n > 0);

  const todoCount = approvals.reduce((s, a) => s + a.n, 0) + todo.moveIns.length + todo.bills.length;
  const nothingToDo = todoCount === 0;

  function scrollToTodo() {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById("todo")?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }

  const modules: { href: string; l: string; status: string; alert?: "amber" | "rose" }[] = [
    { href: "/units", l: t("楼盘", "Units"), status: t(`${data.propertyCount} 个单位`, `${data.propertyCount} units`) },
    { href: "/rooms", l: t("房间", "Rooms"), status: t(`${rooms.vacant} 间空`, `${rooms.vacant} vacant`), alert: rooms.vacant ? "amber" : undefined },
    { href: "/contracts", l: t("合同", "Contracts"), status: t(`${signing.length} 待生效`, `${signing.length} pending`), alert: signing.length ? "amber" : undefined },
    { href: "/payments/review", l: t("收款", "Payments"), status: t(`${todo.pendingReview} 待审`, `${todo.pendingReview} to review`), alert: todo.pendingReview ? "rose" : undefined },
    { href: "/maintenance", l: t("报修", "Maintenance"), status: t(`${todo.maintenanceCount} 跟进中`, `${todo.maintenanceCount} open`), alert: todo.maintenanceCount ? "amber" : undefined },
  ];

  const quickBadges: Record<string, number> = {
    review: todo.pendingReview,
    claims: claims.pending.count + claims.toPay.count,
    maintenance: maintenanceStatus.fresh,
    users: isAdmin ? todo.pendingUsers : 0,
    contracts: todo.pendingApprove,
  };

  const moveIns30 = todo.moveIns.length;
  const nextMoveIn = todo.moveIns.find((m) => m.daysUntil >= 0);
  const renewing = rooms.expiring.filter((c) => c.state === "RENEW_REQUESTED").length;
  const undecided = rooms.expiring.filter((c) => c.state === "UNDECIDED").length;
  const vacancyPct = rooms.total ? Math.round((rooms.vacant / rooms.total) * 100) : 0;

  const STEP_TONE: Record<SignStep, "violet" | "amber" | "blue" | "teal"> = { APPROVE: "violet", AGENT_SIGN: "amber", TENANT_IC: "blue", TENANT_SIGN: "teal" };
  const stepInfo = (step: SignStep) => ({ l: t(SIGN_STEP_LABELS[step].zh, SIGN_STEP_LABELS[step].en), tone: STEP_TONE[step] });

  const curMonth = data.today.slice(0, 7);
  const [cy, cm] = curMonth.split("-").map(Number);
  const nextMonth = `${cm === 12 ? cy + 1 : cy}-${String(cm === 12 ? 1 : cm + 1).padStart(2, "0")}`;

  return (
    <div className="app-type mx-auto max-w-6xl pb-20 md:pb-8">
      <HomeHero name={name} hour={hour} today={data.today} rooms={rooms} todoCount={todoCount} onBell={scrollToTodo} />

      {/* Main areas, overlapping the hero */}
      <nav
        aria-label={t("主要功能", "Main areas")}
        className="relative z-10 mx-1 -mt-11 grid grid-cols-5 rounded-[22px] bg-white px-1 py-3 shadow-[0_2px_4px_rgba(30,27,46,0.04),0_18px_36px_-18px_rgba(76,29,149,0.35)] sm:mx-3 md:-mt-12 md:mx-6"
      >
        {modules.map((m) => {
          const meta = navMeta(m.href);
          return (
            <Link key={m.href} href={m.href} className="flex min-w-0 flex-col items-center gap-1 rounded-2xl px-0.5 py-1 hover:bg-gray-50">
              <span className={`grid h-11 w-11 place-items-center rounded-2xl ${TONE_CLASS[meta.tone]}`}>
                <meta.icon size={22} />
              </span>
              <span className="max-w-full truncate text-[13px] font-medium text-gray-800">{m.l}</span>
              <span
                className={`max-w-full truncate text-[11px] ${m.alert === "rose" ? "font-medium text-rose-600" : m.alert === "amber" ? "font-medium text-amber-700" : "text-gray-400"}`}
              >
                {m.status}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-5 space-y-5">
        <QuickActions role={role} userKey={userCode} badges={quickBadges} onQuote={openQuote} />

        {/* ---------------- Overview ---------------- */}
        <section>
          <h2 className="mb-2 px-1 text-[15px] font-semibold text-gray-900">{t("概览", "At a glance")}</h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile
              href={todo.moveIns.length ? "#move-ins" : "#todo"}
              icon={IconDoorIn}
              tone="teal"
              value={moveIns30}
              label={t("30 天内入住", "Moving in, 30 days")}
              sub={nextMoveIn ? `${nextMoveIn.roomCode} · ${relDay(nextMoveIn.daysUntil)}` : t("暂时没有", "None coming up")}
            />
            <Tile
              href="#expiring"
              icon={IconHourglass}
              tone="amber"
              value={rooms.expiring.length}
              label={t("两个月内到期", "Ending in 2 months")}
              sub={rooms.expiring.length ? t(`${renewing} 要续约 · ${undecided} 未决定`, `${renewing} renewing · ${undecided} undecided`) : t("暂时没有", "None")}
            />
            <Tile
              href="/payments/outstanding"
              icon={IconReceipt}
              tone="rose"
              value={rm(outstanding.amount)}
              label={t("未清账单", "Unpaid bills")}
              sub={t(`${outstanding.count} 张 · 逾期 ${todo.overdueBills.count} 张`, `${outstanding.count} bills · ${todo.overdueBills.count} overdue`)}
            />
            <Tile
              href="/rooms"
              icon={IconBed}
              tone="violet"
              value={
                <>
                  {rooms.vacant}
                  <span className="text-base font-medium text-gray-400"> / {rooms.total}</span>
                </>
              }
              label={t("空房 / 总房间", "Vacant / all rooms")}
            >
              <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-brand-light" aria-hidden="true">
                <span className="block h-full rounded-full bg-brand" style={{ width: `${vacancyPct}%` }} />
              </span>
            </Tile>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <Link href="/rooms" className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-gray-600 shadow-sm hover:bg-gray-50">
              <IconCar size={15} className="text-gray-400" />
              {t("车位", "Carparks")}{" "}
              <b className={rooms.carparks.vacant ? "text-amber-700" : "text-gray-900"}>{t(`空 ${rooms.carparks.vacant}`, `${rooms.carparks.vacant} free`)}</b>
              <span className="text-gray-400">/ {rooms.carparks.total}</span>
            </Link>
            <span className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-gray-600 shadow-sm">
              <IconUsers size={15} className="text-gray-400" />
              {t("租客", "Tenants")} <b className="text-gray-900">{rooms.tenants}</b>
            </span>
            {rooms.store > 0 && (
              <span className="rounded-full bg-white px-3 py-1.5 text-gray-500 shadow-sm">{t(`储藏室 ${rooms.store} 间（不算入住率）`, `${rooms.store} store rooms (not counted)`)}</span>
            )}
          </div>
        </section>

        {/* Sections flow into two balanced columns on a wide screen; on a phone they stack in this order. */}
        <div className="lg:columns-2 lg:gap-4 [&>*]:mb-4 [&>*]:break-inside-avoid">
          {/* ---------------- To-do ---------------- */}
          <Section id="todo" title={t(`待办${todoCount ? ` · ${todoCount}` : ""}`, `To-do${todoCount ? ` · ${todoCount}` : ""}`)}>
            {nothingToDo && (
              <p className="flex items-center justify-center gap-2 py-5 text-sm text-gray-400">
                <IconCheck size={18} className="text-teal-600" />
                {t("目前没有待办事项", "Nothing to do right now")}
              </p>
            )}

            {approvals.length > 0 && (
              <ul className="divide-y divide-gray-100">
                {approvals.map((a) => (
                  <li key={a.l}>
                    <ListRow
                      href={a.href}
                      right={
                        <span className="flex items-center gap-1">
                          <span className="rounded-full bg-rose-500 px-2 py-0.5 text-xs font-bold text-white">{a.n}</span>
                          <IconChevronRight size={16} className="text-gray-300" />
                        </span>
                      }
                    >
                      <span className="flex items-center gap-2.5">
                        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${TONE_CLASS[a.tone]}`}>
                          <a.icon size={17} />
                        </span>
                        <span className="text-gray-800">{a.l}</span>
                      </span>
                    </ListRow>
                  </li>
                ))}
              </ul>
            )}

            {todo.moveIns.length > 0 && (
              <div id="move-ins" className="mt-4 scroll-mt-24 first:mt-0">
                <h3 className="mb-1 text-xs font-semibold text-gray-500">{t(`30 天内入住 · ${todo.moveIns.length}`, `Moving in within 30 days · ${todo.moveIns.length}`)}</h3>
                <ul className="divide-y divide-gray-100">
                  {todo.moveIns.map((m) => (
                    <li key={m.contractCode}>
                      <ListRow
                        href={`/contracts/${m.contractCode}`}
                        right={
                          <>
                            <Pill>{contractStatusLabel(m.status, locale)}</Pill>
                            <span className="mt-0.5 block text-[11px] text-gray-400">{t("未做入住检查", "No move-in check")}</span>
                          </>
                        }
                      >
                        <b className="font-semibold">{m.roomCode}</b> <span className="text-gray-600">{m.tenantName}</span>
                        <span className="block text-xs text-gray-400">
                          {fmtDate(m.date)} · <span className={m.daysUntil < 0 ? "font-medium text-rose-600" : ""}>{relDay(m.daysUntil)}</span>
                          {m.contactNumber ? ` · ${m.contactNumber}` : ""}
                        </span>
                      </ListRow>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {todo.bills.length > 0 && (
              <div className="mt-4 first:mt-0">
                <h3 className="mb-1 text-xs font-semibold text-gray-500">{t(`7 天内要付 · ${todo.bills.length}`, `Bills due within 7 days · ${todo.bills.length}`)}</h3>
                <ul className="divide-y divide-gray-100">
                  {todo.bills.map((b) => (
                    <li key={`${b.kind}-${b.id}-${b.period}`} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                      <Link href={`/units/${b.propertyCode}`} className="min-w-0">
                        <b className="font-semibold">{b.propertyCode}</b> {billLabel(b)}
                        <span className="block truncate text-xs text-gray-400">{[b.provider, b.accountNo, b.amount !== null ? fmtMoney(b.amount) : null].filter(Boolean).join(" · ")}</span>
                        <span className={`block text-xs ${b.overdue ? "font-medium text-rose-600" : "text-amber-700"}`}>
                          {fmtDate(b.dueDate)} {b.overdue ? t(`逾期 ${-b.daysLeft} 天`, `${-b.daysLeft} days overdue`) : `· ${relDay(b.daysLeft)}`}
                        </span>
                      </Link>
                      <button type="button" onClick={() => openPay(b)} className="flex shrink-0 items-center gap-1 rounded-xl bg-brand-light px-3 py-2 text-xs font-semibold text-brand hover:bg-violet-100">
                        <IconCheck size={15} />
                        {t("已付", "Paid")}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Section>

          <CollectionCard initial={collection} maxMonth={nextMonth} minMonth={`${reports.firstYear}-01`} />

          {/* ---------------- Contracts waiting to go live ---------------- */}
          <Section title={t(`待签合同 · ${signing.length}`, `Contracts to sign · ${signing.length}`)} action={<MoreLink href="/contracts">{t("全部合同", "All contracts")}</MoreLink>}>
            {signing.length === 0 ? (
              <p className="py-3 text-center text-sm text-gray-400">{t("没有等待中的合同", "No contracts waiting")}</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {signing.slice(0, 6).map((c) => (
                  <li key={c.contractCode}>
                    <ListRow
                      href={`/contracts/${c.contractCode}`}
                      right={
                        <>
                          <Pill tone={stepInfo(c.step).tone}>{stepInfo(c.step).l}</Pill>
                          <span className={`mt-0.5 block text-[11px] ${c.daysWaiting > 3 ? "font-medium text-rose-600" : "text-gray-400"}`}>
                            {c.daysWaiting === 0 ? t("今天", "today") : t(`等了 ${c.daysWaiting} 天`, `${c.daysWaiting} days`)}
                          </span>
                        </>
                      }
                    >
                      <b className="font-semibold">{c.roomCode}</b> <span className="text-gray-600">{c.tenantName}</span>
                      <span className="block truncate text-xs text-gray-400">
                        {c.contractCode} · {c.agentName === COMPANY.NAME ? t("公司续约", "Company renewal") : c.agentName}
                      </span>
                    </ListRow>
                  </li>
                ))}
              </ul>
            )}
            {signing.length > 6 && (
              <Link href="/contracts" className="mt-1 block text-center text-xs text-brand">
                {t(`还有 ${signing.length - 6} 份`, `${signing.length - 6} more`)}
              </Link>
            )}
          </Section>

          {/* ---------------- Ending soon ---------------- */}
          <Section
            id="expiring"
            title={t(`两个月内到期 · ${rooms.expiring.length}`, `Ending within 2 months · ${rooms.expiring.length}`)}
            action={rooms.expiring.length > 0 ? <MoreLink href={isAdmin ? "/contracts/renewal" : "/contracts"}>{t("续约管理", "Renewals")}</MoreLink> : undefined}
          >
            {rooms.expiring.length === 0 ? (
              <p className="py-3 text-center text-sm text-gray-400">{t("两个月内没有合同到期", "No contracts ending in the next 2 months")}</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {rooms.expiring.slice(0, 8).map((c) => (
                  <li key={c.contractCode}>
                    <ListRow
                      href={`/contracts/${c.contractCode}`}
                      right={
                        <Pill tone={c.state === "RENEW_REQUESTED" ? "teal" : c.state === "MOVING_OUT" ? "gray" : "amber"}>
                          {c.state === "RENEW_REQUESTED" ? t("要续约", "Renewing") : c.state === "MOVING_OUT" ? t("要搬走", "Moving out") : t("未决定", "Undecided")}
                        </Pill>
                      }
                    >
                      <b className="font-semibold">{c.roomCode}</b> <span className="text-gray-600">{c.tenantName}</span>
                      <span className="block text-xs text-gray-400">
                        {fmtDate(c.expiredDate)} · {relDay(c.daysLeft)}
                      </span>
                    </ListRow>
                  </li>
                ))}
              </ul>
            )}
            {rooms.expiring.length > 8 && <p className="mt-1 text-center text-xs text-gray-400">{t(`还有 ${rooms.expiring.length - 8} 份`, `${rooms.expiring.length - 8} more`)}</p>}
          </Section>

          {/* ---------------- Maintenance ---------------- */}
          <Section title={t("报修", "Maintenance")} action={<MoreLink href="/maintenance">{t("报修页面", "Open")}</MoreLink>}>
            <div className="grid grid-cols-3 gap-2">
              {[
                { n: maintenanceStatus.fresh, l: t("新报修", "New"), tone: "bg-amber-50", dot: "bg-amber-500" },
                { n: maintenanceStatus.working, l: t("处理中", "In progress"), tone: "bg-brand-light", dot: "bg-brand" },
                { n: maintenanceStatus.toCheck, l: t("待验收", "To check"), tone: "bg-sky-50", dot: "bg-sky-500" },
              ].map((s) => (
                <Link key={s.l} href="/maintenance" className={`rounded-2xl px-3 py-2.5 ${s.tone} hover:brightness-[0.98]`}>
                  <span className="block text-[22px] font-semibold leading-none text-gray-900">{s.n}</span>
                  <span className="mt-1 flex items-center gap-1.5 text-xs text-gray-600">
                    <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                    {s.l}
                  </span>
                </Link>
              ))}
            </div>

            {todo.maintenance.length > 0 ? (
              <>
                <h3 className="mb-1 mt-4 text-xs font-semibold text-gray-500">{t("需要跟进的单位", "Units to follow up")}</h3>
                <div className="space-y-2">
                  {todo.maintenance.map((u) => (
                    <div key={u.propertyCode} className="rounded-2xl border border-gray-100">
                      <div className="flex items-center justify-between gap-2 rounded-t-2xl bg-gray-50 px-3 py-1.5 text-xs">
                        <b className="truncate">
                          {u.propertyCode} <span className="font-normal text-gray-500">{u.name}</span>
                        </b>
                        <span className="shrink-0 text-gray-500">{t(`${u.items.length} 单`, `${u.items.length} open`)}</span>
                      </div>
                      <ul className="divide-y divide-gray-100 px-3">
                        {u.items.slice(0, 3).map((m) => (
                          <li key={m.requestCode}>
                            <ListRow
                              href="/maintenance"
                              right={
                                <>
                                  <Pill tone={m.status === "PENDING_REVIEW" ? "blue" : m.status === "SUBMITTED" ? "amber" : "gray"}>{maintenanceStatusLabel(m.status, locale)}</Pill>
                                  <span className={`mt-0.5 block text-[11px] ${m.daysOpen > 7 ? "font-medium text-rose-600" : "text-gray-400"}`}>
                                    {t(`开了 ${m.daysOpen} 天`, `${m.daysOpen} days open`)}
                                  </span>
                                </>
                              }
                            >
                              <b className="font-semibold">{m.roomCode}</b> {m.title}
                              <span className="block truncate text-xs text-gray-400">
                                {m.requestCode} · {m.assignedTo ?? t("还没指派", "unassigned")}
                              </span>
                            </ListRow>
                          </li>
                        ))}
                      </ul>
                      {u.items.length > 3 && (
                        <Link href="/maintenance" className="block border-t border-gray-100 py-1.5 text-center text-xs text-brand">
                          {t(`还有 ${u.items.length - 3} 单`, `${u.items.length - 3} more`)}
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="mt-3 text-center text-sm text-gray-400">{t("没有未完成的报修", "No open repairs")}</p>
            )}
          </Section>

          <ReportsCard initial={reports} />

          {/* ---------------- Claims ---------------- */}
          <Section title={t("报销", "Expense claims")} action={<MoreLink href="/claims">{t("全部报销", "All claims")}</MoreLink>}>
            <div className="grid grid-cols-2 gap-2">
              <Link href="/claims" className="rounded-2xl bg-gray-50 px-3 py-2.5 hover:bg-brand-light">
                <span className="block text-[22px] font-semibold leading-none text-gray-900">{claims.pending.count}</span>
                <span className="mt-1 block text-xs text-gray-600">{t("待审批", "To review")}</span>
                <span className="block text-[11px] tabular-nums text-gray-400">{fmtMoney(claims.pending.amount)}</span>
              </Link>
              <Link href="/claims" className="rounded-2xl bg-gray-50 px-3 py-2.5 hover:bg-brand-light">
                <span className="block text-[22px] font-semibold leading-none text-gray-900">{claims.toPay.count}</span>
                <span className="mt-1 block text-xs text-gray-600">{t("已批准，待付款", "Approved, to pay")}</span>
                <span className="block text-[11px] tabular-nums text-gray-400">{fmtMoney(claims.toPay.amount)}</span>
              </Link>
            </div>
            {isAdmin && (
              <Link href="/claims?new=1" className="btn-primary mt-3 block w-full py-2.5 text-center">
                {t("提交报销", "New claim")}
              </Link>
            )}
            <p className="mt-2 text-xs text-gray-400">{t("不包括你自己提交的报销（要由别人审批）。", "Your own claims aren't counted — someone else reviews them.")}</p>
          </Section>

          {/* ---------------- Activity ---------------- */}
          <Section title={t("最近活动", "Recent activity")} action={<MoreLink href="/activity">{t("全部记录", "All activity")}</MoreLink>}>
            {activity.length === 0 ? (
              <p className="py-3 text-center text-sm text-gray-400">{t("还没有记录", "Nothing yet")}</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {activity.map((a) => (
                  <li key={a.id} className="flex gap-3 py-2.5 text-sm">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gray-100 text-xs font-semibold text-gray-600">
                      {(a.userName ?? "?").trim().charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2 text-xs text-gray-400">
                        <span className="truncate">
                          <b className="font-semibold text-gray-700">{a.userName}</b> · {ROLE_LABELS[a.role ?? ""] ?? a.role}
                        </span>
                        <span className="shrink-0 tabular-nums">{timeOf(a.at)}</span>
                      </span>
                      <span className="mt-0.5 block text-gray-800">
                        {a.method === "DELETE" && <span className="mr-1 rounded-md bg-rose-50 px-1.5 py-0.5 text-[11px] font-semibold text-rose-700">{t("删除", "Deleted")}</span>}
                        <span className="mr-1 rounded-md bg-brand-light px-1.5 py-0.5 text-[11px] text-brand">{a.area}</span>
                        {a.summary}
                        {a.target && !a.summary.includes(a.target) && <span className="text-gray-400"> · {a.target}</span>}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>

      <QuickQuote options={quoteOptions} today={data.today} />
      <FabMenu role={role} onQuote={openQuote} />

      {paying && (
        <Modal onClose={() => !saving && setPaying(null)}>
          <h3 className="mb-2 text-base font-semibold text-brand">{t("标记已付", "Mark as paid")}</h3>
          <p className="mb-3 text-sm text-gray-700">
            <b>{paying.propertyCode}</b> {billLabel(paying)} · {t("账单月份", "Bill month")} <b>{paying.period}</b>
            <span className="block text-xs text-gray-500">
              {t("到期", "Due")} {fmtDate(paying.dueDate)}
              {paying.provider ? ` · ${paying.provider}` : ""}
              {paying.accountNo ? ` · ${paying.accountNo}` : ""}
            </span>
          </p>
          {paying.kind === "UTILITY" ? (
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={payForm.book} onChange={(e) => setPayForm({ ...payForm, book: e.target.checked })} />
                {t("同时记入这个单位的支出", "Also record it as an expense for this unit")}
              </label>
              {payForm.book && (
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="mb-1 block text-sm text-gray-600">{t("付了多少 (RM)", "Amount paid (RM)")}</label>
                    <input className="input" type="number" inputMode="decimal" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-gray-600">{t("付款日期", "Paid on")}</label>
                    <input className="input" type="date" max={data.today} value={payForm.paidDate} onChange={(e) => setPayForm({ ...payForm, paidDate: e.target.value })} />
                  </div>
                </div>
              )}
              <p className="text-xs text-gray-400">
                {t("如果已经在单位月报里登记过这笔支出，就不要勾选，免得重复。", "If you already recorded this expense in the unit report, untick this to avoid counting it twice.")}
              </p>
            </div>
          ) : (
            <p className="text-xs text-gray-400">{t("屋主租金已经自动算进损益表，这里只是记录已付款。", "Owner rent is already counted in the P&L — this just records that it was paid.")}</p>
          )}
          <button
            onClick={markPaid}
            disabled={saving || (paying.kind === "UTILITY" && payForm.book && !(Number(payForm.amount) > 0))}
            className="btn-primary mt-4 w-full py-2.5"
          >
            {saving ? t("保存中…", "Saving…") : t("确认已付", "Confirm paid")}
          </button>
        </Modal>
      )}
    </div>
  );
}
