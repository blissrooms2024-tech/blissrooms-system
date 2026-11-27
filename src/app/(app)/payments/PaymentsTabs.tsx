"use client";

import Link from "next/link";
import { useLanguage } from "@/components/LanguageProvider";

/** The two halves of 收款: slips waiting for a decision, and bills nobody has paid yet. */
export default function PaymentsTabs({
  current,
  reviewCount,
  unpaidCount,
}: {
  current: "review" | "unpaid";
  reviewCount?: number;
  unpaidCount?: number;
}) {
  const { t } = useLanguage();
  const tabs = [
    { key: "review", href: "/payments/review", l: t("待审核", "To review"), n: reviewCount },
    { key: "unpaid", href: "/payments/outstanding", l: t("未清账单", "Unpaid bills"), n: unpaidCount },
  ];
  return (
    <nav className="grid max-w-sm grid-cols-2 rounded-xl bg-gray-200/60 p-1 text-[13px] font-medium">
      {tabs.map((tab) => {
        const body = (
          <>
            {tab.l}
            {tab.n !== undefined && <span className="font-normal text-gray-400">{tab.n}</span>}
          </>
        );
        return tab.key === current ? (
          <span key={tab.key} aria-current="page" className="flex h-8 items-center justify-center gap-1 rounded-lg bg-white text-gray-900 shadow-sm">
            {body}
          </span>
        ) : (
          <Link key={tab.key} href={tab.href} className="flex h-8 items-center justify-center gap-1 rounded-lg text-gray-500 hover:text-gray-800">
            {body}
          </Link>
        );
      })}
    </nav>
  );
}
