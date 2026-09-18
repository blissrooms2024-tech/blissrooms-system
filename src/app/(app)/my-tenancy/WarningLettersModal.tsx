"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/Modal";
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
      .catch(() => setError("出错，请稍后再试"));
  }, [contractCode]);

  return (
    <Modal onClose={onClose}>
      <h3 className="text-lg font-bold text-brand">⚠️ 警告信 — {contractCode}</h3>

      {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
      {!letters && !error && <div className="mt-3 text-sm text-gray-500">载入中...</div>}
      {letters && letters.length === 0 && (
        <div className="mt-3 py-3 text-center text-sm text-gray-400">还没有收到警告信</div>
      )}
      {letters && letters.length > 0 && (
        <div className="mt-3 space-y-2">
          {letters.map((l) => (
            <div key={l.letterCode} className="rounded-lg border border-gray-200 p-3">
              <div className="text-xs text-gray-400">
                {fmtDate(l.createdAt)} · {l.triggeredBy === "system-cron" ? "系统自动 (逾期提醒)" : `Admin: ${l.sentBy}`}
              </div>
              <div className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{l.message}</div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
