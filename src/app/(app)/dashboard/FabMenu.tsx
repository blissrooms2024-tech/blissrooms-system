"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Sheet from "@/components/Sheet";
import { useLanguage } from "@/components/LanguageProvider";
import { IconCalculator, IconChevronRight, IconPlus } from "@/components/icons";
import { navMeta, TONE_CLASS } from "@/components/navMeta";

type Item = { key: string; zh: string; en: string; descZh: string; descEn: string; meta: string; href?: string };

/** The floating "+" — everything you start from scratch. Boss can only quote (creating
 * contracts, bills, rooms and claims is Admin work), so for Boss it opens the quote directly. */
export default function FabMenu({ role, onQuote }: { role: string; onQuote: () => void }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const isAdmin = role === "ADMIN";

  const items: Item[] = [
    { key: "quote", zh: "快速报价", en: "Quick quote", descZh: "算押金和 pro-rata，WhatsApp 给 Agent", descEn: "Deposits and pro-rata, ready to WhatsApp", meta: "/quote" },
    ...(isAdmin
      ? [
          { key: "contract", zh: "新合同", en: "New contract", descZh: "为租客开一份新合同", descEn: "Start a tenancy contract", meta: "/contracts/new", href: "/contracts/new" },
          { key: "bulk", zh: "批量开账单", en: "Bulk billing", descZh: "一次给多个租客开账单", descEn: "Bill many tenants at once", meta: "/payments/bulk", href: "/payments/bulk" },
          { key: "meter", zh: "抄表开单", en: "Meter billing", descZh: "输入电表读数，自动算每间房的电费", descEn: "Enter meter readings; each room's share is worked out", meta: "/utilities", href: "/utilities" },
          { key: "claim", zh: "提交报销", en: "New expense claim", descZh: "拍收据，选单位，提交审批", descEn: "Snap the receipt, pick the unit", meta: "/claims", href: "/claims?new=1" },
          { key: "room", zh: "新增房间", en: "Add a room", descZh: "在现有楼盘加房间或车位", descEn: "Add a room or carpark to a unit", meta: "/rooms", href: "/rooms/new" },
          { key: "unit", zh: "新增楼盘", en: "Add a property", descZh: "登记新租下的单位", descEn: "Register a newly leased unit", meta: "/units", href: "/units/new" },
        ]
      : []),
    { key: "todo", zh: "新待办", en: "New to-do", descZh: "给自己或同事加一项，到期那天早上 email 提醒", descEn: "For you or a teammate; emailed the morning it's due", meta: "/todos", href: "/todos?new=1" },
    { key: "meeting", zh: "新会议", en: "New meeting", descZh: "开会时记录，每个人用自己的账号写备注", descEn: "Record a meeting; everyone writes their own notes", meta: "/meetings", href: "/meetings?new=1" },
  ];

  const single = items.length === 1;

  // Tuck the button away while scrolling down a list so it never sits on top of a row's own
  // button (已付, a link…); it comes back as soon as you scroll up or reach the top.
  const [tucked, setTucked] = useState(false);
  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      if (y < 80) setTucked(false);
      else if (y > last + 6) setTucked(true);
      else if (y < last - 6) setTucked(false);
      last = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => (single ? onQuote() : setOpen(true))}
        aria-label={single ? t("快速报价", "Quick quote") : t("新增", "Create")}
        className={`fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-4 z-30 grid h-14 w-14 place-items-center rounded-2xl bg-brand text-white shadow-[0_10px_24px_-6px_rgba(109,40,217,0.55)] transition-[transform,opacity] duration-200 hover:bg-brand-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand motion-reduce:transition-none md:bottom-6 md:right-6 md:translate-y-0 md:opacity-100 ${
          tucked ? "pointer-events-none translate-y-24 opacity-0 md:pointer-events-auto" : ""
        }`}
      >
        {single ? <IconCalculator size={25} /> : <IconPlus size={26} />}
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title={t("新增", "Create")}>
        <ul className="-mx-2">
          {items.map((it) => {
            const m = navMeta(it.meta);
            const body = (
              <>
                <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${TONE_CLASS[m.tone]}`}>
                  <m.icon size={22} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-gray-900">{t(it.zh, it.en)}</span>
                  <span className="block truncate text-xs text-gray-500">{t(it.descZh, it.descEn)}</span>
                </span>
                <IconChevronRight size={18} className="shrink-0 text-gray-300" />
              </>
            );
            const cls = "flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left hover:bg-gray-50";
            return (
              <li key={it.key}>
                {it.href ? (
                  <Link href={it.href} className={cls} onClick={() => setOpen(false)}>
                    {body}
                  </Link>
                ) : (
                  <button
                    type="button"
                    className={cls}
                    onClick={() => {
                      setOpen(false);
                      onQuote();
                    }}
                  >
                    {body}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </Sheet>
    </>
  );
}
