"use client";

import { type ReactNode, type MouseEvent } from "react";
import { useT } from "./LanguageProvider";

export default function ConfirmDialog({
  open,
  title,
  message,
  danger,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title?: string;
  message: ReactNode;
  danger?: boolean;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  if (!open) return null;

  function onBackdropClick(e: MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onCancel();
  }

  return (
    <div
      onClick={onBackdropClick}
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-5"
    >
      <div className="w-full min-w-0 max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-1.5 whitespace-normal text-base font-semibold text-gray-900">
          {title ?? (danger ? t("⚠️ 危险操作", "⚠️ Dangerous Action") : t("确认", "Confirm"))}
        </div>
        {/* whitespace-normal overrides an inherited whitespace-nowrap — this dialog renders
            wherever it's called from in the DOM (it's just position:fixed, not a portal), and
            a table cell's Td ("whitespace-nowrap" to keep table rows single-line) is a common
            ancestor, which would otherwise force this message onto one unwrapped, overflowing
            line regardless of its own width constraints. */}
        <div className="mb-5 min-w-0 break-words whitespace-normal text-sm text-gray-600">{message}</div>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
          >
            {t("取消", "Cancel")}
          </button>
          <button
            onClick={onConfirm}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white ${
              danger ? "bg-red-600 hover:bg-red-700" : "bg-brand hover:bg-brand-dark"
            }`}
          >
            {confirmLabel ?? t("确定", "Confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
