"use client";

import { useLanguage } from "./LanguageProvider";

export default function LanguageToggle({ className = "" }: { className?: string }) {
  const { locale, setLocale } = useLanguage();
  return (
    <button
      onClick={() => setLocale(locale === "zh" ? "en" : "zh")}
      className={`rounded-lg bg-white/15 px-2.5 py-1.5 text-xs font-semibold hover:bg-white/25 sm:px-3 ${className}`}
      title={locale === "zh" ? "Switch to English" : "切换到中文"}
    >
      {locale === "zh" ? "EN" : "中文"}
    </button>
  );
}
