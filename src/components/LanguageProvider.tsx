"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

export type Locale = "zh" | "en";
const STORAGE_KEY = "bliss_locale";

interface LanguageContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  /** Pass the Chinese text and its English translation side by side at the call site —
   * returns whichever matches the current locale. Avoids maintaining a separate keyed
   * dictionary file across a system this size; the translation lives right next to the
   * string it replaces. */
  t: (zh: string, en: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

/** Mounted once in the root layout — every page under it can call useLanguage()/useT(). */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("zh");

  useEffect(() => {
    // Reads after hydration (not during initial render) so server and first client render
    // both output "zh" — no hydration mismatch — then switches to the saved preference.
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      // localStorage isn't available during SSR/first render — this has to run as an effect,
      // not be read synchronously into the initial useState.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved === "zh" || saved === "en") setLocaleState(saved);
    } catch {
      // Private browsing / blocked storage — just stay on the "zh" default.
    }
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      // Ignore — the choice just won't persist across visits.
    }
  }, []);

  const t = useCallback((zh: string, en: string) => (locale === "en" ? en : zh), [locale]);

  return <LanguageContext.Provider value={{ locale, setLocale, t }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}

/** Shorthand for components that only need the translate function, not locale/setLocale. */
export function useT() {
  return useLanguage().t;
}
