"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { useT } from "@/components/LanguageProvider";

export default function ForgotPasswordModal({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const t = useT();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!email) {
      toast.warning(t("请填 Email", "Please enter your Email"));
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
      toast.info(
        data.message || t("如果这个 Email 有账号, 重设邮件已寄出。", "If an account exists for this Email, a reset link has been sent.")
      );
    } catch {
      toast.danger(t("系统出错，请稍后再试", "System error — please try again later"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <h3 className="text-lg font-bold text-brand">{t("忘记密码", "Forgot Password")}</h3>
      <p className="mt-1 text-sm text-gray-500">
        {t("输入你的 Email, 我们会寄重设链接给你。", "Enter your Email and we'll send you a reset link.")}
      </p>
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
        className="mt-4 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:bg-violet-300"
      >
        {loading ? t("寄出中...", "Sending...") : t("寄出重设链接", "Send Reset Link")}
      </button>
    </Modal>
  );
}
