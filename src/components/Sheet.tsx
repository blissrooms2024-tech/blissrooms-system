"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { IconX } from "./icons";

/**
 * A panel that slides up from the bottom on phones (thumb-reachable, like a native action
 * sheet) and sits centred on larger screens. Closes on the backdrop, the × button or Escape;
 * focus moves into the panel while it's open and goes back to where it was afterwards.
 */
export default function Sheet({
  open,
  onClose,
  title,
  children,
  tall = false,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  /** Use most of the screen height (forms); otherwise size to content. */
  tall?: boolean;
}) {
  const panel = useRef<HTMLDivElement>(null);
  // Callers pass a fresh arrow function every render; keep the latest one in a ref so the
  // open/close effect below runs only when the sheet actually opens or closes (re-running it
  // on every keystroke would yank focus out of the inputs).
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const before = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      before?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-5" role="dialog" aria-modal="true">
      <button type="button" aria-label="Close" tabIndex={-1} className="absolute inset-0 cursor-default bg-[#1e1b2e]/45" onClick={onClose} />
      <div
        ref={panel}
        tabIndex={-1}
        className={`sheet-up relative flex w-full flex-col rounded-t-3xl bg-white shadow-2xl outline-none sm:max-w-lg sm:rounded-3xl ${
          tall ? "h-[92dvh] sm:h-auto sm:max-h-[88vh]" : "max-h-[88dvh] sm:max-h-[88vh]"
        }`}
        // The page's normal ink, not whatever the opener sits in — a sheet opened from the purple
        // home header would otherwise inherit its white text (typed search words went invisible).
        style={{ paddingBottom: "env(safe-area-inset-bottom)", color: "var(--foreground)" }}
      >
        <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-gray-200 sm:hidden" />
        {title !== undefined && (
          <div className="flex shrink-0 items-center justify-between gap-3 px-5 pb-2 pt-3">
            <div className="text-base font-semibold text-gray-900">{title}</div>
            <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-gray-500 hover:bg-gray-100">
              <IconX size={20} />
            </button>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5">{children}</div>
      </div>
    </div>
  );
}
