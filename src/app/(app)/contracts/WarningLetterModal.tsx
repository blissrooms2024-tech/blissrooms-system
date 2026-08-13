"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import { useToast } from "@/components/Toast";

const TEMPLATES = [
  { label: "迟交房租", text: "你已多次逾期缴交房租，请注意每月25号前完成付款，否则将影响你的租约状态。" },
  { label: "违反 House Rules", text: "根据现场检查/其他住户反馈，你的行为已违反 House Rules 相关条款，请立即改善，否则合同可能被终止。" },
  { label: "长期未上传水单", text: "你有账单长期未上传付款水单，请在3天内补交，否则将产生迟交罚款。" },
];

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
        onClose();
      } else {
        toast.danger(data.message);
      }
    } catch {
      toast.danger("系统出错，请稍后再试");
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <h3 className="text-lg font-bold text-brand">⚠️ 发警告信 — {contractCode} ({tenantName})</h3>
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
        className="input mt-2.5 h-32"
        placeholder="警告内容..."
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />

      <button onClick={send} disabled={sending} className="btn-primary mt-3">
        {sending ? "发送中..." : "发送警告信"}
      </button>
    </Modal>
  );
}
