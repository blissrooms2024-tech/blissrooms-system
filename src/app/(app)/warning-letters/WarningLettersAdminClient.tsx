"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/components/LanguageProvider";
import { fmtDate } from "@/lib/format";
import ConfirmDialog from "@/components/ConfirmDialog";

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

export default function WarningLettersAdminClient({ role }: { role: string }) {
  const { t } = useLanguage();
  const [letters, setLetters] = useState<Letter[] | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [deleting, setDeleting] = useState<Letter | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);
  const [deleteError, setDeleteError] = useState("");

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

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteSaving(true);
    setDeleteError("");
    try {
      const res = await fetch(`/api/contracts/${deleting.contractCode}/warning-letter/${deleting.letterCode}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.success) {
        setDeleteError(data.message);
        return;
      }
      setLetters((prev) => prev?.filter((l) => l.letterCode !== deleting.letterCode) ?? null);
      setDeleting(null);
    } catch {
      setDeleteError(t("网络连接失败，请检查网络后重试", "Network connection failed — please check your connection and try again"));
    } finally {
      setDeleteSaving(false);
    }
  }

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
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <Link
                  href={`/warning-letter/${l.letterCode}`}
                  target="_blank"
                  className="text-xs font-semibold text-brand underline"
                >
                  {t("📄 查看正式信件", "📄 View Official Letter")}
                </Link>
                {role === "ADMIN" && (
                  <button
                    onClick={() => {
                      setDeleteError("");
                      setDeleting(l);
                    }}
                    className="text-xs font-semibold text-red-600 underline"
                  >
                    🗑️ {t("删除", "Delete")}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={!!deleting}
        danger
        title={t("删除警告信记录？", "Delete this warning letter record?")}
        message={
          deleting
            ? t(
                `确定要删除 ${deleting.tenantName}（${deleting.contractCode}）的这封警告信记录吗？这只会删除记录，不会撤回已经发出的 Email。${deleteError ? `\n\n❌ ${deleteError}` : ""}`,
                `Delete this warning letter record for ${deleting.tenantName} (${deleting.contractCode})? This only removes the record — it will not un-send the email already sent.${deleteError ? `\n\n❌ ${deleteError}` : ""}`
              )
            : ""
        }
        confirmLabel={deleteSaving ? t("删除中...", "Deleting...") : t("确定删除", "Delete")}
        onConfirm={confirmDelete}
        onCancel={() => {
          setDeleting(null);
          setDeleteError("");
        }}
      />
    </div>
  );
}
