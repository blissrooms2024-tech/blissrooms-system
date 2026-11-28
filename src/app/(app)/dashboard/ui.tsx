import Link from "next/link";
import type { ReactNode } from "react";
import { IconChevronRight } from "@/components/icons";

/** Small building blocks shared by the home page sections. */

/** "RM12,340" — whole ringgit, for tiles and headlines (lists keep fmtMoney's cents). */
export const rm = (v: number) => `RM${Math.round(v).toLocaleString("en-US")}`;

export function Section({
  id,
  title,
  action,
  children,
  className = "",
}: {
  id?: string;
  title: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={`scroll-mt-20 rounded-[20px] bg-white p-4 shadow-[0_1px_2px_rgba(30,27,46,0.04),0_12px_28px_-18px_rgba(76,29,149,0.22)] sm:p-5 ${className}`}
    >
      <div className="mb-3 flex min-h-6 items-center justify-between gap-2">
        <h2 className="text-[15px] font-semibold text-gray-900">{title}</h2>
        {action}
      </div>
      <div>{children}</div>
    </section>
  );
}

export function MoreLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="flex shrink-0 items-center gap-0.5 text-xs font-medium text-brand hover:underline">
      {children}
      <IconChevronRight size={14} />
    </Link>
  );
}

export { default as Pill } from "@/components/Pill";

/** A tappable list row: main line, optional sub line, optional right side. */
export function ListRow({ href, children, right }: { href?: string; children: ReactNode; right?: ReactNode }) {
  const inner = (
    <>
      <span className="min-w-0 flex-1">{children}</span>
      {right !== undefined && <span className="shrink-0 text-right">{right}</span>}
    </>
  );
  const cls = "flex items-center justify-between gap-3 py-2.5 text-sm";
  return href ? (
    <Link href={href} className={`${cls} -mx-2 rounded-xl px-2 hover:bg-gray-50`}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}
