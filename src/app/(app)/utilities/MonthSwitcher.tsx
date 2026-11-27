"use client";

import { useLanguage } from "@/components/LanguageProvider";
import { IconChevronLeft, IconChevronRight } from "@/components/icons";

const shift = (month: string, n: number) => {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

/** ‹ 2026年11月 › — the billing month for 抄表开单. */
export default function MonthSwitcher({ value, max, onChange }: { value: string; max: string; onChange: (v: string) => void }) {
  const { t, locale } = useLanguage();
  const [y, m] = value.split("-").map(Number);
  const label = locale === "en" ? new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" }) : `${y}年${m}月`;
  return (
    <div className="flex items-center gap-0.5 rounded-xl bg-white p-1 shadow-sm">
      <button type="button" onClick={() => onChange(shift(value, -1))} aria-label={t("上个月", "Previous month")} className="grid h-9 w-9 place-items-center rounded-lg text-gray-600 hover:bg-gray-100">
        <IconChevronLeft size={18} />
      </button>
      <span className="min-w-[88px] text-center text-sm font-medium text-gray-900">{label}</span>
      <button
        type="button"
        onClick={() => onChange(shift(value, 1))}
        disabled={value >= max}
        aria-label={t("下个月", "Next month")}
        className="grid h-9 w-9 place-items-center rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-30"
      >
        <IconChevronRight size={18} />
      </button>
    </div>
  );
}
