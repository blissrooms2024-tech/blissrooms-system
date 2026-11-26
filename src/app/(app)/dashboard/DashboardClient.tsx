"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { useLanguage } from "@/components/LanguageProvider";
import { fmtDate, fmtMoney } from "@/lib/format";
import { contractStatusLabel, maintenanceStatusLabel, ROLE_LABELS } from "@/lib/config";
import { label, UTILITY_TYPE_LABELS } from "@/lib/unitInfo";
import type { DashboardData } from "@/lib/dashboard";
import type { QuoteOptions } from "@/lib/quoteOptions";
import QuickQuote from "./QuickQuote";
import ReportsCard from "./ReportsCard";

type Bill = DashboardData["todo"]["bills"][number];


function Card({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-xl bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-brand">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function SubHead({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-2 mt-4 flex items-center justify-between gap-2 first:mt-0">
      <h4 className="text-sm font-semibold text-gray-700">{children}</h4>
      {right}
    </div>
  );
}

function Stat({ n, l, href, tone = "text-brand" }: { n: ReactNode; l: string; href?: string; tone?: string }) {
  const body = (
    <>
      <div className={`text-xl font-bold ${tone}`}>{n}</div>
      <div className="text-xs text-gray-500">{l}</div>
    </>
  );
  return href ? (
    <Link href={href} className="rounded-xl bg-gray-50 p-3 text-center transition hover:bg-brand-light">
      {body}
    </Link>
  ) : (
    <div className="rounded-xl bg-gray-50 p-3 text-center">{body}</div>
  );
}

export default function DashboardClient({
  data,
  quoteOptions,
  role,
  name,
}: {
  data: DashboardData;
  quoteOptions: QuoteOptions;
  role: string;
  name: string;
}) {
  const { t, locale } = useLanguage();
  const router = useRouter();
  const toast = useToast();
  const isAdmin = role === "ADMIN";
  const [paying, setPaying] = useState<Bill | null>(null);
  const [payForm, setPayForm] = useState({ amount: "", paidDate: data.today, book: true });
  const [saving, setSaving] = useState(false);

  const { reports, rooms, todo, claims, activity } = data;

  const relDay = (days: number) =>
    days === 0 ? t("今天", "today") : days === 1 ? t("明天", "tomorrow") : days > 0 ? t(`${days} 天后`, `in ${days} days`) : t(`已过 ${-days} 天`, `${-days} days ago`);

  const timeOf = (iso: string) => {
    const d = new Date(iso);
    const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    const local = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return local === data.today ? `${t("今天", "Today")} ${hm}` : `${fmtDate(local)} ${hm}`;
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

  const billLabel = (b: Bill) =>
    b.kind === "OWNER_RENT" ? `🏠 ${t("屋主租金", "Owner rent")}` : label(UTILITY_TYPE_LABELS, b.utilityType ?? "OTHER", locale);

  const approvals = [
    { n: todo.pendingReview, l: t("交易单待审核", "Payment slips to review"), href: "/payments/review", icon: "🧾" },
    { n: todo.pendingApprove, l: t("合同待批准", "Contracts to approve"), href: "/contracts", icon: "📄" },
    ...(isAdmin ? [{ n: todo.pendingUsers, l: t("新用户待激活", "New users to activate"), href: "/users", icon: "👥" }] : []),
    { n: claims.pending.count, l: t("报销待审批", "Claims to review"), href: "/claims", icon: "💸" },
    { n: claims.toPay.count, l: t("报销待付款", "Claims to pay"), href: "/claims", icon: "💰" },
    { n: todo.overdueBills.count, l: t(`租客逾期账单 (${fmtMoney(todo.overdueBills.amount)})`, `Overdue tenant bills (${fmtMoney(todo.overdueBills.amount)})`), href: "/payments/outstanding", icon: "⚠️" },
  ].filter((a) => a.n > 0);

  const nothingToDo = approvals.length === 0 && todo.moveIns.length === 0 && todo.maintenance.length === 0 && todo.bills.length === 0;

  const shortcuts = [
    ...(isAdmin ? [{ href: "/contracts/new", icon: "➕", l: t("新合同", "New contract") }] : []),
    { href: "/payments/review", icon: "🧾", l: t("交易单审核", "Slip review") },
    { href: "/payments/outstanding", icon: "📋", l: t("未清账单", "Outstanding") },
    ...(isAdmin ? [{ href: "/payments/bulk", icon: "📢", l: t("批量开账单", "Bulk billing") }] : []),
    { href: "/maintenance", icon: "🔧", l: t("报修", "Maintenance") },
    { href: "/claims", icon: "💸", l: t("报销", "Claims") },
    ...(isAdmin ? [{ href: "/contracts/renewal", icon: "🔁", l: t("续约管理", "Renewals") }] : []),
    { href: "/pnl", icon: "📈", l: t("损益表", "P&L") },
    { href: "/finance", icon: "💰", l: t("财务总览", "Finance") },
    { href: "/units", icon: "🏢", l: t("楼盘", "Units") },
    { href: "/rooms", icon: "🏠", l: t("房间", "Rooms") },
    { href: "/vouchers", icon: "🎟️", l: t("代金券", "Vouchers") },
    { href: "/activity", icon: "🕘", l: t("活动记录", "Activity") },
  ];


  return (
    <div className="space-y-4">
      <div className="px-1">
        <div className="text-lg font-semibold">
          {t("你好", "Hi")}, {name} 👋
        </div>
        <div className="text-xs text-gray-500">{fmtDate(data.today)}</div>
      </div>

      <QuickQuote options={quoteOptions} today={data.today} />

      <ReportsCard initial={reports} />

      {/* ---------------- Rooms ---------------- */}
      <Card
        title={`🏠 ${t("房间与租客", "Rooms & tenants")}`}
        action={
          <Link href="/rooms" className="text-xs text-brand underline">
            {t("房间清单 →", "Rooms →")}
          </Link>
        }
      >
        <div className="mb-3">
          <div className="mb-1 flex items-end justify-between">
            <span className="text-sm text-gray-600">{t("整体出租率", "Overall occupancy")}</span>
            <span className="text-2xl font-bold text-brand">{Math.round(rooms.occupancyRate * 100)}%</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-gray-100">
            <div className="h-full rounded-full bg-brand" style={{ width: `${Math.round(rooms.occupancyRate * 100)}%` }} />
          </div>
          <div className="mt-1 text-xs text-gray-400">
            {t(`已出租 ${rooms.occupied} / ${rooms.total} 间（不含储藏室）`, `${rooms.occupied} of ${rooms.total} rooms let (storage excluded)`)}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          <Stat n={rooms.total} l={t("房间总数", "Rooms")} />
          <Stat n={rooms.occupied} l={t("已出租", "Occupied")} />
          <Stat n={rooms.vacant} l={t("空房", "Vacant")} tone={rooms.vacant ? "text-amber-600" : "text-brand"} href="/rooms" />
          <Stat n={rooms.reserved} l={t("已订", "Reserved")} />
          <Stat n={rooms.maintenance} l={t("维修中", "Under repair")} />
          <Stat n={rooms.tenants} l={t("租客", "Tenants")} />
        </div>
        <div className="mt-2.5 rounded-lg bg-gray-50 px-3 py-2 text-sm">
          🚗 {t("车位", "Carparks")}: {t("共", "")} <b>{rooms.carparks.total}</b> {t("个", "total")} ·{" "}
          <span className={rooms.carparks.vacant ? "font-semibold text-amber-600" : ""}>
            {t("空", "vacant")} {rooms.carparks.vacant}
          </span>{" "}
          · {t("已租", "let")} {rooms.carparks.occupied}
        </div>

        <SubHead
          right={
            rooms.expiring.length > 0 && (
              <Link href={isAdmin ? "/contracts/renewal" : "/contracts"} className="text-xs text-brand underline">
                {t("续约管理 →", "Renewals →")}
              </Link>
            )
          }
        >
          ⏰ {t("两个月内合同到期", "Contracts ending within 2 months")} ({rooms.expiring.length})
        </SubHead>
        {rooms.expiring.length === 0 ? (
          <div className="text-sm text-gray-400">{t("没有", "None")}</div>
        ) : (
          <div className="divide-y divide-gray-100 rounded-lg border border-gray-100 text-sm">
            {rooms.expiring.slice(0, 8).map((c) => (
              <Link key={c.contractCode} href={`/contracts/${c.contractCode}`} className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-gray-50">
                <span className="min-w-0">
                  <b>{c.roomCode}</b> <span className="text-gray-600">{c.tenantName}</span>
                  <span className="block text-xs text-gray-400">
                    {fmtDate(c.expiredDate)} · {relDay(c.daysLeft)}
                  </span>
                </span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                    c.state === "RENEW_REQUESTED" ? "bg-green-100 text-green-800" : c.state === "MOVING_OUT" ? "bg-gray-100 text-gray-600" : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {c.state === "RENEW_REQUESTED" ? t("要续约", "Renewing") : c.state === "MOVING_OUT" ? t("要搬走", "Moving out") : t("未决定", "Undecided")}
                </span>
              </Link>
            ))}
            {rooms.expiring.length > 8 && <div className="px-3 py-2 text-xs text-gray-400">+{rooms.expiring.length - 8}</div>}
          </div>
        )}
      </Card>

      {/* ---------------- To-do ---------------- */}
      <Card title={`✅ ${t("待办清单", "To-do")}`}>
        {nothingToDo && <div className="py-4 text-center text-sm text-gray-400">🎉 {t("目前没有待办事项", "Nothing to do right now")}</div>}

        {approvals.length > 0 && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {approvals.map((a) => (
              <Link key={a.l} href={a.href} className="flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2.5 text-sm hover:bg-amber-100">
                <span>
                  {a.icon} {a.l}
                </span>
                <b className="rounded-full bg-amber-500 px-2 text-white">{a.n}</b>
              </Link>
            ))}
          </div>
        )}

        {todo.moveIns.length > 0 && (
          <>
            <SubHead>
              🚪 {t("即将入住", "Upcoming move-ins")} ({todo.moveIns.length})
            </SubHead>
            <div className="divide-y divide-gray-100 rounded-lg border border-gray-100 text-sm">
              {todo.moveIns.map((m) => (
                <Link key={m.contractCode} href={`/contracts/${m.contractCode}`} className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-gray-50">
                  <span className="min-w-0">
                    <b>{m.roomCode}</b> <span className="text-gray-600">{m.tenantName}</span>
                    <span className="block text-xs text-gray-400">
                      {fmtDate(m.date)} · <span className={m.daysUntil < 0 ? "text-red-600" : ""}>{relDay(m.daysUntil)}</span>
                      {m.contactNumber ? ` · ${m.contactNumber}` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-xs">
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">{contractStatusLabel(m.status, locale)}</span>
                    <span className="mt-0.5 block text-gray-400">{t("未做入住检查", "No move-in check yet")}</span>
                  </span>
                </Link>
              ))}
            </div>
          </>
        )}

        {todo.maintenance.length > 0 && (
          <>
            <SubHead
              right={
                <Link href="/maintenance" className="text-xs text-brand underline">
                  {t("报修页面 →", "Maintenance →")}
                </Link>
              }
            >
              🔧 {t("维修跟进", "Maintenance follow-up")} ({todo.maintenanceCount}
              {todo.maintenanceToClose ? t(`，${todo.maintenanceToClose} 单待验收`, `, ${todo.maintenanceToClose} to check`) : ""})
            </SubHead>
            <div className="space-y-2">
              {todo.maintenance.map((u) => (
                <div key={u.propertyCode} className="rounded-lg border border-gray-100">
                  <div className="flex items-center justify-between bg-gray-50 px-3 py-1.5 text-xs">
                    <b>
                      {u.propertyCode} <span className="font-normal text-gray-500">{u.name}</span>
                    </b>
                    <span className="text-gray-500">{u.items.length} {t("单", "open")}</span>
                  </div>
                  {u.items.map((m) => (
                    <Link key={m.requestCode} href="/maintenance" className="flex items-center justify-between gap-2 border-t border-gray-100 px-3 py-2 text-sm hover:bg-gray-50">
                      <span className="min-w-0">
                        <b>{m.roomCode}</b> {m.title}
                        <span className="block text-xs text-gray-400">
                          {m.requestCode}
                          {m.assignedTo ? ` · ${m.assignedTo}` : ` · ${t("还没指派", "unassigned")}`}
                        </span>
                      </span>
                      <span className="shrink-0 text-right text-xs">
                        <span className={`rounded-full px-2 py-0.5 ${m.status === "PENDING_REVIEW" ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-600"}`}>
                          {maintenanceStatusLabel(m.status, locale)}
                        </span>
                        <span className={`mt-0.5 block ${m.daysOpen > 7 ? "font-semibold text-red-600" : "text-gray-400"}`}>
                          {t(`开了 ${m.daysOpen} 天`, `${m.daysOpen} days open`)}
                        </span>
                      </span>
                    </Link>
                  ))}
                </div>
              ))}
            </div>
          </>
        )}

        {todo.bills.length > 0 && (
          <>
            <SubHead>
              💡 {t("付款提醒（7 天内到期）", "Bills due within 7 days")} ({todo.bills.length})
            </SubHead>
            <div className="divide-y divide-gray-100 rounded-lg border border-gray-100 text-sm">
              {todo.bills.map((b) => (
                <div key={`${b.kind}-${b.id}-${b.period}`} className="flex items-center justify-between gap-2 px-3 py-2">
                  <Link href={`/units/${b.propertyCode}`} className="min-w-0">
                    <b>{b.propertyCode}</b> {billLabel(b)}
                    <span className="block text-xs text-gray-400">
                      {[b.provider, b.accountNo, b.amount !== null ? fmtMoney(b.amount) : null].filter(Boolean).join(" · ")}
                    </span>
                    <span className={`block text-xs ${b.overdue ? "font-semibold text-red-600" : "text-amber-700"}`}>
                      {fmtDate(b.dueDate)} {b.overdue ? t(`逾期 ${-b.daysLeft} 天`, `${-b.daysLeft} days overdue`) : `· ${relDay(b.daysLeft)}`}
                    </span>
                  </Link>
                  <button onClick={() => openPay(b)} className="btn-soft shrink-0 px-3 py-1.5 text-xs">
                    ✓ {t("已付", "Paid")}
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      {/* ---------------- Shortcuts ---------------- */}
      <Card title={`⚡ ${t("快捷键", "Shortcuts")}`}>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-7">
          <button
            onClick={() => window.dispatchEvent(new Event("open-quick-quote"))}
            className="flex flex-col items-center gap-1 rounded-xl bg-gray-50 px-1 py-3 text-center text-xs hover:bg-brand-light"
          >
            <span className="text-xl">🧮</span>
            <span className="leading-tight text-gray-700">{t("快速报价", "Quick quote")}</span>
          </button>
          {shortcuts.map((s) => (
            <Link key={s.href} href={s.href} className="flex flex-col items-center gap-1 rounded-xl bg-gray-50 px-1 py-3 text-center text-xs hover:bg-brand-light">
              <span className="text-xl">{s.icon}</span>
              <span className="leading-tight text-gray-700">{s.l}</span>
            </Link>
          ))}
        </div>
      </Card>

      {/* ---------------- Claims ---------------- */}
      <Card
        title={`💸 ${t("报销", "Expense claims")}`}
        action={
          <Link href="/claims" className="text-xs text-brand underline">
            {t("查看全部 →", "All claims →")}
          </Link>
        }
      >
        <div className="grid grid-cols-2 gap-2">
          <Stat n={claims.pending.count} l={`${t("待审批", "To review")} · ${fmtMoney(claims.pending.amount)}`} href="/claims" tone={claims.pending.count ? "text-amber-600" : "text-brand"} />
          <Stat n={claims.toPay.count} l={`${t("待付款", "To pay")} · ${fmtMoney(claims.toPay.amount)}`} href="/claims" tone={claims.toPay.count ? "text-blue-700" : "text-brand"} />
        </div>
        {isAdmin && (
          <Link href="/claims" className="btn-primary mt-2.5 block w-full py-2.5 text-center">
            ➕ {t("提交报销", "New claim")}
          </Link>
        )}
        <p className="mt-2 text-xs text-gray-400">{t("不包括你自己提交的报销（要由别人审批）。", "Your own claims aren't counted — someone else reviews them.")}</p>
      </Card>

      {/* ---------------- Activity ---------------- */}
      <Card
        title={`🕘 ${t("最近活动", "Recent activity")}`}
        action={
          <Link href="/activity" className="text-xs text-brand underline">
            {t("查看全部 →", "All activity →")}
          </Link>
        }
      >
        {activity.length === 0 ? (
          <div className="py-3 text-center text-sm text-gray-400">{t("还没有记录", "Nothing yet")}</div>
        ) : (
          <div className="divide-y divide-gray-100 text-sm">
            {activity.map((a) => (
              <div key={a.id} className="py-2">
                <div className="flex items-center justify-between gap-2 text-xs text-gray-400">
                  <span>
                    <b className="text-gray-700">{a.userName}</b> · {ROLE_LABELS[a.role ?? ""] ?? a.role}
                  </span>
                  <span>{timeOf(a.at)}</span>
                </div>
                <div className="mt-0.5">
                  {a.method === "DELETE" && <span className="mr-1 rounded bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-700">{t("删除", "Deleted")}</span>}
                  <span className="mr-1 rounded bg-brand-light px-1.5 py-0.5 text-xs text-brand">{a.area}</span>
                  {a.summary}
                  {a.target && !a.summary.includes(a.target) && <span className="text-gray-400"> · {a.target}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {paying && (
        <Modal onClose={() => !saving && setPaying(null)}>
          <h3 className="mb-2 text-base font-semibold text-brand">
            ✓ {t("标记已付", "Mark as paid")}
          </h3>
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
