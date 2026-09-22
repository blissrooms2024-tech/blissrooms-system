"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Modal from "@/components/Modal";
import { useT } from "@/components/LanguageProvider";
import { fmtDate } from "@/lib/format";

interface Letter {
  letterCode: string;
  message: string;
  sentBy: string;
  triggeredBy: string;
  createdAt: string;
}

/** Read-only view of warning letters sent to the tenant on this contract — the same content
 * already emailed to them, so they can also check it inside the app. No send/delete controls;
 * those stay in the Admin-only WarningLetterModal. */
export default function WarningLettersModal({
  contractCode,
  onClose,
}: {
  contractCode: string;
  onClose: () => void;
}) {
  const t = useT();
  const [letters, setLetters] = useState<Letter[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/contracts/${contractCode}/warning-letter`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.success) {
          setError(data.message);
          return;
        }
        setLetters(data.letters);
      })
      .catch(() => setError(t("出错，请稍后再试", "Something went wrong — please try again later")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractCode]);

  return (
    <Modal onClose={onClose}>
      <h3 className="text-lg font-bold text-brand">
        {t("⚠️ 警告信", "⚠️ Warning Letters")} — {contractCode}
      </h3>

      {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
      {!letters && !error && <div className="mt-3 text-sm text-gray-500">{t("载入中...", "Loading...")}</div>}
      {letters && letters.length === 0 && (
        <div className="mt-3 py-3 text-center text-sm text-gray-400">{t("还没有收到警告信", "No warning letters received yet")}</div>
      )}
      {letters && letters.length > 0 && (
        <div className="mt-3 space-y-2">
          {letters.map((l) => (
            <div key={l.letterCode} className="rounded-lg border border-gray-200 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="text-xs text-gray-400">
                  {fmtDate(l.createdAt)} ·{" "}
                  {l.triggeredBy === "system-cron" ? t("系统自动 (逾期提醒)", "Automated (overdue reminder)") : `Admin: ${l.sentBy}`}
                </div>
                <Link
                  href={`/warning-letter/${l.letterCode}`}
                  target="_blank"
                  className="shrink-0 text-xs font-semibold text-brand underline"
                >
                  {t("📄 查看正式信件", "📄 View Official Letter")}
                </Link>
              </div>
              <div className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{l.message}</div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
