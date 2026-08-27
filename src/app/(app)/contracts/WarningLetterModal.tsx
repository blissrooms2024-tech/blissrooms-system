"use client";

import { useState, useEffect, useCallback } from "react";
import Modal from "@/components/Modal";
import { useToast } from "@/components/Toast";
import ConfirmDialog from "@/components/ConfirmDialog";

const TEMPLATES = [
  {
    label: "迟交房租",
    text: "You have repeatedly paid rent late. Please make sure payment is completed by the 25th of each month, or your tenancy status may be affected.",
  },
  {
    label: "违反 House Rules",
    text: "Based on an on-site inspection / feedback from other residents, your conduct has violated the House Rules. Please correct this immediately, or the contract may be terminated.",
  },
  {
    label: "长期未上传水单",
    text: "You have an outstanding bill with no payment slip uploaded for an extended period. Please submit it within 3 days, or a late payment penalty will apply.",
  },
];

interface Letter {
  letterCode: string;
  message: string;
  sentBy: string;
  triggeredBy: string;
  createdAt: string;
}

export default function WarningLetterModal({
  contractCode,
  tenantName,
  onClose,
}: {
  contractCode: string;
  tenantName: string;
  onClose: () => void;
}) {
  const toast = useToast();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [letters, setLetters] = useState<Letter[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/contracts/${contractCode}/warning-letter`);
    const data = await res.json();
    if (data.success) setLetters(data.letters);
  }, [contractCode]);

  useEffect(() => {
    // setState happens after the fetch's await, not synchronously in the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function send() {
    if (!message.trim()) {
      toast.warning("请填警告内容");
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
      toast.danger("系统出错，请稍后再试");
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

  return (
    <Modal onClose={onClose} wide>
      <h3 className="text-lg font-bold text-brand">⚠️ 警告信 — {contractCode} ({tenantName})</h3>
      <p className="mt-1 text-sm text-gray-500">会直接发邮件给租客登录邮箱。</p>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {TEMPLATES.map((t) => (
          <button
            key={t.label}
            type="button"
            onClick={() => setMessage(t.text)}
            className="rounded-md bg-gray-100 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-200"
          >
            模板: {t.label}
          </button>
        ))}
      </div>

      <textarea
        className="input mt-2.5 h-24"
        placeholder="警告内容..."
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />

      <button onClick={send} disabled={sending} className="btn-primary mt-3">
        {sending ? "发送中..." : "发送警告信"}
      </button>

      <b className="mt-4 block text-sm">📜 警告信记录</b>
      {letters.length === 0 && <div className="py-3 text-center text-sm text-gray-400">还没有发过警告信</div>}
      <div className="mt-1.5 space-y-2">
        {letters.map((l) => (
          <div key={l.letterCode} className="rounded-lg border border-gray-200 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-xs text-gray-400">
                  {l.createdAt.slice(0, 10)} · {l.triggeredBy === "system-cron" ? "系统自动 (逾期提醒)" : `Admin: ${l.sentBy}`}
                </div>
                <div className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{l.message}</div>
              </div>
              <button
                onClick={() => setDeleting(l.letterCode)}
                className="shrink-0 rounded-md bg-red-50 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-100"
              >
                撤销
              </button>
            </div>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={!!deleting}
        danger
        message="确定撤销这封警告信记录？（邮件已经发出去了, 这只会移除系统里的记录）"
        confirmLabel="确定撤销"
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </Modal>
  );
}
