import Link from "next/link";
import { IconChevronRight } from "./icons";

/** Where you are: 楼盘 › Pixel KL › PXC-01 › CT-U2. Each step but the last goes back up. */
export default function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="breadcrumb" className="-mb-1 flex min-w-0 items-center gap-0.5 overflow-hidden whitespace-nowrap px-1 text-[12.5px] text-gray-500">
      {items.map((it, i) => {
        const last = i === items.length - 1;
        return (
          <span key={`${i}-${it.label}`} className={`flex min-w-0 items-center gap-0.5 ${last ? "shrink" : "shrink-0"}`}>
            {i > 0 && <IconChevronRight size={13} className="shrink-0 text-gray-300" />}
            {it.href && !last ? (
              <Link href={it.href} className="truncate hover:text-brand hover:underline">
                {it.label}
              </Link>
            ) : (
              <span aria-current={last ? "page" : undefined} className={`truncate ${last ? "font-medium text-gray-700" : ""}`}>
                {it.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
