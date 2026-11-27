import Link from "next/link";
import { TONE_CLASS, type NavIcon, type Tone } from "./navMeta";

const RAISED_TEXT: Record<Tone, string> = {
  violet: "text-brand",
  teal: "text-teal-700",
  amber: "text-amber-700",
  rose: "text-rose-600",
  slate: "text-slate-600",
};

/** One icon-over-label button, used for the home quick actions and the 更多 page grid.
 * "tinted" squares sit on a white card; "raised" (white, lifted) squares sit straight on the
 * lavender page background, where a pale tint would disappear. */
export default function ActionTile({
  href,
  onClick,
  icon: Icon,
  tone,
  label,
  badge,
  variant = "tinted",
}: {
  href?: string;
  onClick?: () => void;
  icon: NavIcon;
  tone: Tone;
  label: string;
  badge?: number;
  variant?: "tinted" | "raised";
}) {
  const square =
    variant === "raised"
      ? `bg-white shadow-[0_1px_2px_rgba(30,27,46,0.06),0_8px_16px_-10px_rgba(76,29,149,0.35)] ${RAISED_TEXT[tone]}`
      : TONE_CLASS[tone];
  const inner = (
    <>
      <span className={`relative grid h-12 w-12 place-items-center rounded-2xl ${square}`}>
        <Icon size={24} />
        {!!badge && (
          <span className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </span>
      <span className="line-clamp-2 text-center text-xs leading-tight text-gray-700">{label}</span>
    </>
  );
  const cls = `flex min-w-0 flex-col items-center gap-1.5 rounded-2xl px-1 py-2 transition-colors focus-visible:outline-2 focus-visible:outline-brand ${
    variant === "raised" ? "hover:bg-white/70 active:bg-white/70" : "hover:bg-gray-50 active:bg-gray-50"
  }`;
  return href ? (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}
