"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useToast } from "@/components/Toast";
import { useLanguage } from "@/components/LanguageProvider";
import ConfirmDialog from "@/components/ConfirmDialog";
import { fmtDate } from "@/lib/format";

const TEMPLATES = [
  {
    labelZh: "拖欠房租",
    labelEn: "Overdue Rental",
    text: `In reference to the Tenancy Agreement, which was duly signed and acknowledged by you as the tenant, we regret to inform you that you have breached one of the agreed tenancy terms and house rules despite our repeated attempts to reach you.

Breach of Tenancy Clause
Term No. 1 states that rental payment shall be made by the 25th of every month (in advance of the actual month), or shall not be later than the 5th of the actual month, or such later day as may be agreed by BLISS ROOMS ENTERPRISE ("Bliss Rooms") in writing.

As stated in the Agreement, any breach of the terms, conditions, or house rules grants the Management the right to terminate, amend, or penalise the tenant/agreement immediately, with or without refund of the deposit, as stipulated in the Agreement. All tenants are required to comply fully with the said procedures and rules.

This breach concerns non-payment of [X] month's rental, despite our repeated attempts to contact you through phone calls, WhatsApp messages, and WhatsApp calls. To date, we have not received the outstanding rental payment nor any response from you. Therefore, the Management reserves the right to impose penalties or take further action without prejudice.

Please be informed that if payment is not received, or if you do not respond to us, by [DEADLINE DATE], BLISS ROOMS ENTERPRISE will have no choice but to proceed with the following actions:
• Block all access cards linked to this unit;
• Change the room door lock; and
• Forfeit the deposit(s) held under this tenancy.

We trust you understand the seriousness of this matter and urge you to settle the outstanding rental and contact our office immediately.

If payment has already been made, kindly disregard this letter and contact our office with proof of payment for our records.`,
  },
  {
    labelZh: "违反 House Rules",
    labelEn: "House Rules Violation",
    text: "Based on an on-site inspection / feedback from other residents, your conduct has violated the House Rules. Please correct this immediately, or the contract may be terminated.",
  },
  {
    labelZh: "长期未上传交易单",
    labelEn: "Transaction Slip Not Uploaded",
    text: "You have an outstanding bill with no transaction slip uploaded for an extended period. Please submit it within 3 days, or a late payment penalty will apply.",
  },
];

interface Letter {
  letterCode: string;
  message: string;
  sentBy: string;
  triggeredBy: string;
  createdAt: string;
}

export default function WarningLetterComposeClient({ contractCode }: { contractCode: string }) {
  const toast = useToast();
  const { locale, t } = useLanguage();
  const [tenantName, setTenantName] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [letters, setLetters] = useState<Letter[] | null>(null);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const [contractRes, lettersRes] = await Promise.all([
        fetch(`/api/contracts/${contractCode}`),
        fetch(`/api/contracts/${contractCode}/warning-letter`),
      ]);
      const contractData = await contractRes.json();
      const lettersData = await lettersRes.json();
      if (!contractData.success) {
        setError(contractData.message);
        return;
      }
      setTenantName(contractData.contract.tenantName);
      if (lettersData.success) setLetters(lettersData.letters);
    } catch {
      setError(t("出错，请稍后再试", "Something went wrong — please try again later"));
    }
  }, [contractCode, t]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function send() {
    if (!message.trim()) {
      toast.warning(t("请填警告内容", "Please enter the warning content"));
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`/api/contracts/${contractCode}/warning-letter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setMessage("");
        load();
      } else {
        toast.danger(data.message);
      }
    } catch {
      toast.danger(t("系统出错，请稍后再试", "System error — please try again later"));
    } finally {
      setSending(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    const letterCode = deleting;
    setDeleting(null);
    const res = await fetch(`/api/contracts/${contractCode}/warning-letter/${letterCode}`, { method: "DELETE" });
    const data = await res.json();
    if (data.success) toast.success(data.message);
    else toast.danger(data.message);
    load();
  }

  if (error) return <div className="rounded-xl bg-white p-5 text-sm text-red-600 shadow-sm">{error}</div>;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="rounded-xl bg-white p-5 shadow-sm">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-brand">
            ⚠️ {t("警告信", "Warning Letter")} — {contractCode} {tenantName ? `(${tenantName})` : ""}
          </h3>
          <Link href={`/contracts/${contractCode}`} className="text-sm text-gray-500 hover:underline">
            ← {t("返回合同", "Back to Contract")}
          </Link>
        </div>
        <p className="mb-3.5 text-sm text-gray-500">
          {t("会直接发邮件给租客登录邮箱。", "This is emailed directly to the tenant's login email.")}
        </p>

        <div className="mb-2.5 flex flex-wrap gap-1.5">
          {TEMPLATES.map((tpl) => (
            <button
              key={tpl.labelZh}
              type="button"
              onClick={() => setMessage(tpl.text)}
              className="rounded-md bg-gray-100 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-200"
            >
              {t("模板", "Template")}: {locale === "en" ? tpl.labelEn : tpl.labelZh}
            </button>
          ))}
        </div>

        <textarea
          className="input h-[420px] resize-y font-mono text-[13px] leading-relaxed"
          placeholder={t("警告内容...", "Warning content...")}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />

        <button onClick={send} disabled={sending} className="btn-primary mt-3">
          {sending ? t("发送中...", "Sending...") : t("发送警告信", "Send Warning Letter")}
        </button>
      </div>

      <div className="rounded-xl bg-white p-5 shadow-sm">
        <b className="mb-2.5 block text-sm text-brand">📜 {t("警告信记录", "Warning Letter History")}</b>
        {!letters && <div className="py-3 text-center text-sm text-gray-500">{t("载入中...", "Loading...")}</div>}
        {letters && letters.length === 0 && (
          <div className="py-3 text-center text-sm text-gray-400">{t("还没有发过警告信", "No warning letters sent yet")}</div>
        )}
        <div className="space-y-2">
          {letters?.map((l) => (
            <div key={l.letterCode} className="rounded-lg border border-gray-200 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-gray-400">
                    {fmtDate(l.createdAt)} ·{" "}
                    {l.triggeredBy === "system-cron"
                      ? t("系统自动 (逾期提醒)", "Automatic (overdue reminder)")
                      : `Admin: ${l.sentBy}`}
                  </div>
                  <div className="mt-1 max-h-24 overflow-hidden whitespace-pre-wrap text-sm text-gray-700">
                    {l.message}
                  </div>
                  <Link
                    href={`/warning-letter/${l.letterCode}`}
                    target="_blank"
                    className="mt-1 inline-block text-xs font-semibold text-brand underline"
                  >
                    📄 {t("查看正式信件", "View Formal Letter")}
                  </Link>
                </div>
                <button
                  onClick={() => setDeleting(l.letterCode)}
                  className="shrink-0 rounded-md bg-red-50 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-100"
                >
                  {t("撤销", "Revoke")}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <ConfirmDialog
        open={!!deleting}
        danger
        message={t(
          "确定撤销这封警告信记录？（邮件已经发出去了, 这只会移除系统里的记录）",
          "Revoke this warning letter record? (The email has already been sent — this only removes the system record.)"
        )}
        confirmLabel={t("确定撤销", "Confirm Revoke")}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
