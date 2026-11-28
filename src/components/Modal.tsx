"use client";

import { ReactNode, MouseEvent } from "react";
import { useT } from "./LanguageProvider";

export default function Modal({
  children,
  onClose,
  wide,
}: {
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const t = useT();

  function onBackdropClick(e: MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div
      onClick={onBackdropClick}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-5"
    >
      {/* Phone: full-width bottom sheet with tight padding. Desktop: centered dialog as before. */}
      <div
        className={`max-h-[92dvh] w-full overflow-auto overscroll-contain rounded-t-2xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:max-h-[90vh] sm:rounded-xl sm:p-6 ${
          wide ? "sm:max-w-3xl" : "sm:max-w-2xl"
        }`}
      >
        <div className="mx-auto -mt-1 mb-3 h-1.5 w-10 rounded-full bg-gray-300 sm:hidden" />
        {children}
        <div className="mt-4 text-right">
          <button
            onClick={onClose}
            className="w-full rounded-lg bg-brand-light px-4 py-3 text-sm font-semibold text-brand hover:bg-violet-100 sm:w-auto sm:py-2"
          >
            {t("关闭", "Close")}
          </button>
        </div>
      </div>
    </div>
  );
}
