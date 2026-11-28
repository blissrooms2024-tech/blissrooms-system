"use client";

import { useState } from "react";
import { SUPPORT } from "@/lib/config";
import { useLanguage } from "@/components/LanguageProvider";

/** The contact list itself — two rows (room/tenancy vs system/technical), each with Call + WhatsApp. */
export function SupportList({ compact = false }: { compact?: boolean }) {
  const { locale, t } = useLanguage();
  return (
    <div className="space-y-2.5">
      {SUPPORT.map((s) => (
        <div key={s.key} className={`rounded-lg border border-gray-200 ${compact ? "p-2.5" : "p-3"}`}>
          <div className="text-xs text-gray-500">{locale === "en" ? s.labelEn : s.label}</div>
          <div className="text-sm font-semibold text-gray-800">
            {s.name} · {s.phone}
          </div>
          <div className="mt-2 flex gap-2">
            <a
              href={`tel:${s.tel}`}
              className="flex-1 rounded-lg bg-brand-light px-3 py-2.5 text-center text-sm font-semibold text-brand hover:bg-violet-100 sm:py-2"
            >
              📞 {t("打电话", "Call")}
            </a>
            <a
              href={`https://wa.me/${s.wa}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 rounded-lg bg-green-600 px-3 py-2.5 text-center text-sm font-semibold text-white hover:bg-green-700 sm:py-2"
            >
              💬 WhatsApp
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}

/** "联系客服" button that opens a small sheet with SupportList.
 * floating: round button bottom-right (tenant pages). inline: plain menu-style row (staff sidebar). */
export default function SupportButton({
  variant = "floating",
  raised = false,
}: {
  variant?: "floating" | "inline";
  /** Lift the floating button above the phone bottom nav. */
  raised?: boolean;
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  return (
    <>
      {variant === "floating" ? (
        <button
          onClick={() => setOpen(true)}
          className={`no-print fixed right-4 z-20 flex ${raised ? "bottom-[calc(4.5rem+env(safe-area-inset-bottom))] md:bottom-4" : "bottom-[max(1rem,env(safe-area-inset-bottom))]"} items-center gap-1.5 rounded-full bg-brand px-4 py-3 text-sm font-semibold text-white shadow-lg hover:bg-brand-dark`}
          aria-label={t("联系客服", "Contact Support")}
        >
          🎧 <span>{t("联系客服", "Support")}</span>
        </button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="flex w-full items-center border-l-[3px] border-transparent px-5 py-3 text-left text-sm text-gray-700 hover:bg-gray-50"
        >
          🎧 {t("联系客服", "Contact Support")}
        </button>
      )}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-5"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="w-full rounded-t-2xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:max-w-sm sm:rounded-xl sm:p-5">
            <div className="mx-auto -mt-1 mb-3 h-1.5 w-10 rounded-full bg-gray-300 sm:hidden" />
            <h3 className="text-base font-bold text-brand">🎧 {t("联系客服", "Contact Support")}</h3>
            <p className="mb-3 mt-1 text-xs text-gray-500">
              {t("系统用不了或屋内要维修找 Miss Yi Xuan；入住和其他客服问题找 Miss Tan。两个号码都可以 WhatsApp。", "System or in-house repair issues → Miss Yi Xuan. Move-in and other enquiries → Miss Tan. Both numbers are on WhatsApp.")}
            </p>
            <SupportList />
            <button
              onClick={() => setOpen(false)}
              className="mt-3 w-full rounded-lg bg-gray-100 px-4 py-3 text-sm font-semibold text-gray-700 sm:py-2"
            >
              {t("关闭", "Close")}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
