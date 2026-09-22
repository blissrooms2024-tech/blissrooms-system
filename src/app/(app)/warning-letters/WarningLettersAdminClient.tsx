"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/components/LanguageProvider";
import { fmtDate } from "@/lib/format";

interface Letter {
  letterCode: string;
  contractCode: string;
  tenantName: string;
  roomCode: string;
  message: string;
  sentBy: string;
  triggeredBy: string;
  createdAt: string;
}

export default function WarningLettersAdminClient() {
  const { t } = useLanguage();
  const [letters, setLetters] = useState<Letter[] | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    fetch("/api/warning-letters")
      .then((r) => r.json())
      .then((data) => {
        if (!data.success) {
          setError(data.message);
          return;
        }
        setLetters(data.letters);
      })
      .catch(() => setError(t("出错，请稍后再试", "Something went wrong — please try again later")));
  }, [t]);

  if (!letters && !error) return <div className="rounded-xl bg-white p-5 text-sm text-gray-500 shadow-sm">{t("载入中...", "Loading...")}</div>;
  if (error) return <div className="rounded-xl bg-white p-5 text-sm text-red-600 shadow-sm">{error}</div>;

  const keyword = q.trim().toLowerCase();
  const filtered = keyword
    ? letters!.filter(
        (l) =>
          l.tenantName.toLowerCase().includes(keyword) ||
          l.contractCode.toLowerCase().includes(keyword) ||
          l.roomCode.toLowerCase().includes(keyword)
      )
    : letters!;

  return (
    <div className="rounded-xl bg-white p-5 shadow-sm">
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-brand">{t(`⚠️ 警告信记录 (${letters!.length})`, `⚠️ Warning Letter Records (${letters!.length})`)}</h3>
        <input
          className="input w-[220px] text-sm"
          placeholder={t("搜索租客 / 合同 / 房间...", "Search tenant / contract / room...")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {filtered.length === 0 && <div className="py-8 text-center text-sm text-gray-400">{t("还没有发过警告信", "No warning letters sent yet")}</div>}

      <div className="space-y-2">
        {filtered.map((l) => (
          <div key={l.letterCode} className="rounded-lg border border-gray-200 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">
                  {l.tenantName} ·{" "}
                  <Link href={`/contracts/${l.contractCode}`} className="text-brand hover:underline">
                    {l.contractCode}
                  </Link>{" "}
                  · {l.roomCode}
                </div>
                <div className="text-xs text-gray-400">
                  {fmtDate(l.createdAt)} ·{" "}
                  {l.triggeredBy === "system-cron" ? t("系统自动 (逾期提醒)", "Automated (overdue reminder)") : `Admin: ${l.sentBy}`}
                </div>
                <div className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{l.message}</div>
              </div>
              <Link
                href={`/warning-letter/${l.letterCode}`}
                target="_blank"
                className="shrink-0 text-xs font-semibold text-brand underline"
              >
                {t("📄 查看正式信件", "📄 View Official Letter")}
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
