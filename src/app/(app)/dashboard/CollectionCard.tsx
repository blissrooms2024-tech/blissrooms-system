"use client";

import { useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/components/LanguageProvider";
import { IconChevronLeft, IconChevronRight } from "@/components/icons";
import { fmtMoney } from "@/lib/format";
import type { CollectionData } from "@/lib/collection";
import { rm, Section } from "./ui";

// Status colours (collected = good, under review = warning, unpaid = critical), checked as a
// set for colour-blind separation; each always sits beside its name and amount.
const COLORS = { collected: "#0d9488", reviewing: "#f59e0b", unpaid: "#e11d48" };

const shift = (month: string, n: number) => {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

export default function CollectionCard({ initial, maxMonth, minMonth }: { initial: CollectionData; maxMonth: string; minMonth: string }) {
  const { t, locale } = useLanguage();
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(false);

  async function go(month: string) {
    if (month > maxMonth || month < minMonth || loading) return;
    setLoading(true);
    try {
      const d = await fetch(`/api/dashboard/collection?month=${month}`).then((r) => r.json());
      if (d.success) setData(d as CollectionData);
    } finally {
      setLoading(false);
    }
  }

  const [y, m] = data.month.split("-").map(Number);
  const monthLabel = locale === "en" ? new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" }) : `${y}年${m}月`;
  const parts = [
    { key: "collected", label: t("已收", "Collected"), b: data.collected, color: COLORS.collected, href: undefined },
    { key: "reviewing", label: t("待审核", "To review"), b: data.reviewing, color: COLORS.reviewing, href: "/payments/review" },
    { key: "unpaid", label: t("未付", "Unpaid"), b: data.unpaid, color: COLORS.unpaid, href: "/payments/outstanding" },
  ] as const;
  const shown = parts.filter((p) => p.b.amount > 0);
  const pct = Math.round(data.rate * 100);

  return (
    <Section
      title={t("收款", "Collections")}
      action={
        <div className="flex items-center gap-0.5 text-xs font-medium text-gray-600">
          <button
            type="button"
            onClick={() => go(shift(data.month, -1))}
            disabled={data.month <= minMonth}
            aria-label={t("上个月", "Previous month")}
            className="grid h-8 w-8 place-items-center rounded-lg hover:bg-gray-100 disabled:opacity-30"
          >
            <IconChevronLeft size={16} />
          </button>
          <span className="min-w-[72px] text-center">{monthLabel}</span>
          <button
            type="button"
            onClick={() => go(shift(data.month, 1))}
            disabled={data.month >= maxMonth}
            aria-label={t("下个月", "Next month")}
            className="grid h-8 w-8 place-items-center rounded-lg hover:bg-gray-100 disabled:opacity-30"
          >
            <IconChevronRight size={16} />
          </button>
        </div>
      }
    >
      <div className={`transition-opacity ${loading ? "opacity-50" : ""}`} aria-busy={loading}>
        {data.billed === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">{t("这个月还没有账单", "No bills for this month yet")}</p>
        ) : (
          <>
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-[28px] font-semibold leading-tight text-gray-900">{rm(data.collected.amount)}</span>
              <span className="text-sm text-gray-500">{t(`已收 ${pct}%`, `${pct}% collected`)}</span>
            </div>
            <p className="text-xs text-gray-500">
              {t(`应收 ${rm(data.billed)} · ${data.collected.count + data.reviewing.count + data.unpaid.count} 张账单`, `${rm(data.billed)} billed · ${data.collected.count + data.reviewing.count + data.unpaid.count} bills`)}
            </p>

            <div
              className="mt-3 flex h-2 gap-[2px] overflow-hidden rounded-full"
              role="img"
              aria-label={parts.map((p) => `${p.label} ${fmtMoney(p.b.amount)}`).join("，")}
            >
              {shown.map((p) => (
                <div key={p.key} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${(p.b.amount / data.billed) * 100}%`, background: p.color }} />
              ))}
            </div>

            <ul className="mt-2 divide-y divide-gray-100">
              {parts.map((p) => {
                const row = (
                  <>
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: p.color }} />
                      <span className="text-gray-700">{p.label}</span>
                      <span className="text-xs text-gray-400">{t(`${p.b.count} 张`, `${p.b.count}`)}</span>
                    </span>
                    <span className="flex items-center gap-1 font-medium tabular-nums text-gray-900">
                      {fmtMoney(p.b.amount)}
                      {p.href && <IconChevronRight size={14} className="text-gray-300" />}
                    </span>
                  </>
                );
                return (
                  <li key={p.key}>
                    {p.href ? (
                      <Link href={p.href} className="-mx-2 flex items-center justify-between gap-2 rounded-xl px-2 py-2.5 text-sm hover:bg-gray-50">
                        {row}
                      </Link>
                    ) : (
                      <div className="flex items-center justify-between gap-2 py-2.5 text-sm">{row}</div>
                    )}
                  </li>
                );
              })}
            </ul>
            {data.overdue.count > 0 && (
              <p className="mt-1 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {t(`其中 ${data.overdue.count} 张已过期，共 ${fmtMoney(data.overdue.amount)}`, `${data.overdue.count} of these are overdue — ${fmtMoney(data.overdue.amount)}`)}
              </p>
            )}
          </>
        )}
      </div>
    </Section>
  );
}
