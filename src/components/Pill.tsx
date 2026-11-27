import type { ReactNode } from "react";

/** Tone → background/text classes; exported for older badges that keep their own size. */
export const PILL = {
  gray: "bg-gray-100 text-gray-600",
  violet: "bg-brand-light text-brand",
  teal: "bg-teal-50 text-teal-800",
  amber: "bg-amber-50 text-amber-800",
  rose: "bg-rose-50 text-rose-700",
  blue: "bg-sky-50 text-sky-800",
} as const;

export type PillTone = keyof typeof PILL;

/** Small rounded status label. */
export default function Pill({ tone = "gray", children }: { tone?: PillTone; children: ReactNode }) {
  return <span className={`inline-block shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${PILL[tone]}`}>{children}</span>;
}
