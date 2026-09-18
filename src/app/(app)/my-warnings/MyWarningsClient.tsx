"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fmtDate } from "@/lib/format";

interface Letter {
  letterCode: string;
  contractCode: string;
  message: string;
  sentBy: string;
  triggeredBy: string;
  createdAt: string;
}

export default function MyWarningsClient() {
  const [letters, setLetters] = useState<Letter[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/contracts/warning-summary")
      .then((r) => r.json())
      .then((data) => {
        if (!data.success) {
          setError(data.message);
          return;
        }
        setLetters(data.letters);
      })
      .catch(() => setError("出错，请稍后再试"));
  }, []);

  return (
    <div className="rounded-xl bg-white p-5 shadow-sm">
      <h3 className="text-lg font-bold text-brand">⚠️ 警告信 Warning Letter</h3>

      {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
      {!letters && !error && <div className="mt-3 text-sm text-gray-500">载入中...</div>}
      {letters && letters.length === 0 && (
        <div className="mt-3 py-8 text-center text-sm text-gray-400">还没有收到警告信</div>
      )}
      {letters && letters.length > 0 && (
        <div className="mt-3.5 space-y-2.5">
          {letters.map((l) => (
            <div key={l.letterCode} className="rounded-lg border border-gray-200 p-3.5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="text-xs text-gray-400">
                  {l.contractCode} · {fmtDate(l.createdAt)} ·{" "}
                  {l.triggeredBy === "system-cron" ? "系统自动 (逾期提醒)" : `Admin: ${l.sentBy}`}
                </div>
                <Link
                  href={`/warning-letter/${l.letterCode}`}
                  target="_blank"
                  className="shrink-0 text-xs font-semibold text-brand underline"
                >
                  📄 查看正式信件
                </Link>
              </div>
              <div className="mt-1.5 whitespace-pre-wrap text-sm text-gray-700">{l.message}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
