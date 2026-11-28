"use client";

import { useLanguage } from "@/components/LanguageProvider";
import { IconBell } from "@/components/icons";

/** A unit floor plan in thin line-work — three rooms, a bathroom, door swings, two beds — drawn
 * faintly behind the occupancy figure. */
function FloorPlan({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 340 260" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {/* dimension line over the first room */}
      <path d="M20 6h120M20 2v8M140 2v8" strokeWidth={1} />
      {/* outer walls, front door gap at the bottom */}
      <path d="M20 20h300v220H200M160 240H20V20" strokeWidth={2.4} />
      {/* bedroom walls with door gaps */}
      <path d="M140 20v100M20 120h40M96 120h104M236 120h84" strokeWidth={2} />
      {/* bathroom */}
      <path d="M250 150h70M250 186v54" strokeWidth={2} />
      {/* door leaves and swings */}
      <path d="M60 120V84a36 36 0 0 1 36 36" />
      <path d="M236 120V84a36 36 0 0 0-36 36" />
      <path d="M250 186h-36a36 36 0 0 1 36-36" />
      <path d="M160 240v-40a40 40 0 0 1 40 40" />
      {/* beds */}
      <rect x="30" y="30" width="52" height="68" rx="4" />
      <path d="M30 47h52" />
      <rect x="258" y="30" width="52" height="68" rx="4" />
      <path d="M258 47h52" />
      {/* sofa and table in the living area */}
      <rect x="38" y="168" width="78" height="28" rx="6" />
      <path d="M38 178h78" />
      <rect x="62" y="208" width="30" height="18" rx="3" />
      {/* bathroom fittings */}
      <rect x="282" y="200" width="28" height="30" rx="8" />
      <circle cx="300" cy="166" r="8" />
    </svg>
  );
}

export default function HomeHero({
  name,
  hour,
  today,
  rooms,
  todoCount,
  onBell,
}: {
  name: string;
  /** Hour of day in Malaysia, worked out on the server so the greeting renders the same on both sides. */
  hour: number;
  today: string;
  rooms: { total: number; occupied: number; vacant: number; reserved: number; maintenance: number; occupancyRate: number };
  todoCount: number;
  onBell: () => void;
}) {
  const { t, locale } = useLanguage();
  const greeting =
    hour >= 5 && hour < 12 ? t("早上好", "Good morning") : hour >= 12 && hour < 18 ? t("下午好", "Good afternoon") : t("晚上好", "Good evening");

  const [y, m, d] = today.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const dateLine =
    locale === "en"
      ? `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][weekday]}, ${d} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1]} ${y}`
      : `${y}年${m}月${d}日 星期${"日一二三四五六"[weekday]}`;

  const pct = Math.round(rooms.occupancyRate * 100);
  const extra = [
    rooms.reserved ? t(`已订 ${rooms.reserved}`, `${rooms.reserved} reserved`) : null,
    rooms.maintenance ? t(`维修中 ${rooms.maintenance}`, `${rooms.maintenance} under repair`) : null,
  ].filter(Boolean);

  return (
    <div className="relative -mx-3 -mt-3 overflow-hidden rounded-b-[28px] bg-brand px-5 pb-16 pt-3 text-white sm:-mx-5 sm:-mt-5 sm:px-6 md:mx-0 md:mt-0 md:rounded-[28px] md:pb-20 md:pt-6">
      <FloorPlan className="pointer-events-none absolute -right-16 -top-4 h-[250px] w-[330px] text-white/[0.13] sm:right-4 md:h-[290px] md:w-[380px]" />

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
          onClick={onBell}
          aria-label={t(`待办 ${todoCount} 项`, `${todoCount} to-dos`)}
          className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/15 hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-white"
        >
          <IconBell size={21} />
          {todoCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[11px] font-bold ring-2 ring-brand">
              {todoCount > 99 ? "99+" : todoCount}
            </span>
          )}
        </button>
      </div>

      <div className="relative mt-6">
        <p className="text-xs text-white/70">{t("整体入住率", "Overall occupancy")}</p>
        <div className="mt-1 flex items-end gap-4">
          <span className="text-[64px] font-semibold leading-[0.85] tracking-[-0.03em]">
            {pct}
            <span className="ml-0.5 text-[30px] tracking-normal">%</span>
          </span>
          <span className="pb-1 text-[13px] leading-snug text-white/85">
            {t(`${rooms.occupied} / ${rooms.total} 间已出租`, `${rooms.occupied} of ${rooms.total} rooms let`)}
            <br />
            <b className="font-semibold text-white">{t(`${rooms.vacant} 间空房`, `${rooms.vacant} vacant`)}</b>
            {extra.length > 0 && <span className="text-white/70"> · {extra.join(" · ")}</span>}
          </span>
        </div>
        <div
          className="mt-4 h-2 max-w-md overflow-hidden rounded-full bg-white/20"
          role="meter"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-label={t("入住率", "Occupancy")}
        >
          <div className="h-full rounded-full bg-white" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}
