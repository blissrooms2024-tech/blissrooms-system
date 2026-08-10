"use client";

import { useState } from "react";
import Modal from "@/components/Modal";

export default function ForgotPasswordModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!email) {
      setMessage("请填 Email");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      setMessage(data.message || "如果这个 Email 有账号, 重设邮件已寄出。");
    } catch {
      setMessage("系统出错，请稍后再试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <h3 className="text-lg font-bold text-brand">忘记密码</h3>
      <p className="mt-1 text-sm text-gray-500">输入你的 Email, 我们会寄重设链接给你。</p>
      <label className="mb-1.5 mt-3.5 block text-sm text-gray-600">Email</label>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none"
      />
      <button
        onClick={submit}
        disabled={loading}
        className="mt-4 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:bg-blue-300"
      >
        {loading ? "寄出中..." : "寄出重设链接"}
      </button>
      {message && <div className="mt-2.5 text-sm text-gray-600">{message}</div>}
    </Modal>
  );
}
