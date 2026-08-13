"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

type ToastType = "success" | "danger" | "warning" | "info";
interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  success: (message: string) => void;
  danger: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const STYLES: Record<ToastType, { bg: string; border: string; text: string; icon: string }> = {
  success: { bg: "bg-emerald-50", border: "border-emerald-300", text: "text-emerald-800", icon: "✅" },
  danger: { bg: "bg-red-50", border: "border-red-300", text: "text-red-800", icon: "⛔" },
  warning: { bg: "bg-amber-50", border: "border-amber-300", text: "text-amber-800", icon: "⚠️" },
  info: { bg: "bg-violet-50", border: "border-violet-300", text: "text-violet-800", icon: "💡" },
};

let idSeq = 0;

/** App-wide popup notifications (danger/warning/success/info) — mounted once in the root layout. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const remove = useCallback((id: number) => {
    setItems((list) => list.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (type: ToastType, message: string) => {
      if (!message) return;
      const id = ++idSeq;
      setItems((list) => [...list, { id, type, message }]);
      timers.current.set(
        id,
        setTimeout(() => remove(id), 5000)
      );
    },
    [remove]
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      success: (m) => push("success", m),
      danger: (m) => push("danger", m),
      warning: (m) => push("warning", m),
      info: (m) => push("info", m),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2">
        {items.map((t) => {
          const s = STYLES[t.type];
          return (
            <div
              key={t.id}
              className={`toast-pop pointer-events-auto flex items-start gap-2.5 rounded-xl border ${s.border} ${s.bg} px-4 py-3 text-sm shadow-lg`}
            >
              <span className="shrink-0">{s.icon}</span>
              <span className={`flex-1 ${s.text}`}>{t.message}</span>
              <button
                onClick={() => remove(t.id)}
                className={`shrink-0 ${s.text} opacity-50 hover:opacity-100`}
                aria-label="关闭"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
