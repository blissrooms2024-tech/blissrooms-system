"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "./LanguageProvider";
import { IconBed, IconContract, IconGrid, IconHome, IconWallet } from "./icons";
import type { NavIcon } from "./navMeta";

type Tab = { href: string; zh: string; en: string; icon: NavIcon; match: string[]; badge?: number };

/**
 * Phone-only bottom navigation for Boss/Admin — the four places they go most, plus 更多 for
 * everything else. A page that isn't one of the four (P&L, claims, users…) is reached from 更多,
 * so 更多 stays highlighted while you're there, the way a native app keeps its tab lit.
 */
export default function MobileTabBar({ alerts }: { alerts: Record<string, number> }) {
  const pathname = usePathname();
  const { t } = useLanguage();

  const tabs: Tab[] = [
    { href: "/dashboard", zh: "首页", en: "Home", icon: IconHome, match: ["/dashboard"] },
    { href: "/contracts", zh: "合同", en: "Contracts", icon: IconContract, match: ["/contracts"], badge: alerts["/contracts"] },
    { href: "/rooms", zh: "房间", en: "Rooms", icon: IconBed, match: ["/rooms", "/units"] },
    { href: "/payments/review", zh: "收款", en: "Payments", icon: IconWallet, match: ["/payments"], badge: alerts["/payments/review"] },
    {
      href: "/more",
      zh: "更多",
      en: "More",
      icon: IconGrid,
      match: ["/more"],
      badge: (alerts["/users"] ?? 0) + (alerts["/claims"] ?? 0),
    },
  ];

  const hit = (m: string) => pathname === m || pathname.startsWith(m + "/");
  const activeHref = tabs.find((tab) => tab.match.some(hit))?.href ?? "/more";

  return (
    <nav
      aria-label={t("主要导航", "Main navigation")}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200/80 bg-white/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto grid max-w-lg grid-cols-5">
        {tabs.map((tab) => {
          const active = tab.href === activeHref;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center gap-0.5 pb-1.5 pt-2 text-[11px] font-medium ${active ? "text-brand" : "text-gray-500"}`}
            >
              <span className={`relative flex h-7 w-14 items-center justify-center rounded-full transition-colors ${active ? "bg-brand-light" : ""}`}>
                <Icon size={22} />
                {!!tab.badge && (
                  <span className="absolute -top-1 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white">
                    {tab.badge > 99 ? "99+" : tab.badge}
                  </span>
                )}
              </span>
              <span>{t(tab.zh, tab.en)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
