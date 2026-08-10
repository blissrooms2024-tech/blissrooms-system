"use client";

import { ReactNode, MouseEvent } from "react";

export default function Modal({
  children,
  onClose,
  wide,
}: {
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  function onBackdropClick(e: MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div
      onClick={onBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-5"
    >
      <div
        className={`max-h-[90vh] w-full overflow-auto rounded-xl bg-white p-6 ${
          wide ? "max-w-3xl" : "max-w-2xl"
        }`}
      >
        {children}
        <div className="mt-4 text-right">
          <button
            onClick={onClose}
            className="rounded-lg bg-brand-light px-4 py-2 text-sm font-semibold text-brand hover:bg-blue-100"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
