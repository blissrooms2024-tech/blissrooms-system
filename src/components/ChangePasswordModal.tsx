"use client";

import { useState } from "react";
import Modal from "./Modal";
import { useToast } from "./Toast";
import { useT } from "./LanguageProvider";

export default function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const t = useT();
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [newPw2, setNewPw2] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (newPw.length < 4) {
      toast.warning(t("新密码至少4位", "New password must be at least 4 characters"));
      return;
    }
    if (newPw !== newPw2) {
      toast.warning(t("两次新密码不一样", "The two new passwords don't match"));
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPassword: oldPw, newPassword: newPw }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setTimeout(onClose, 1200);
      } else {
        toast.danger(data.message);
      }
    } catch {
      toast.danger(t("系统出错，请稍后再试", "System error — please try again later"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <h3 className="text-lg font-bold text-brand">{t("🔑 改密码", "🔑 Change Password")}</h3>
      <label className="mb-1.5 mt-3.5 block text-sm text-gray-600">{t("旧密码", "Old Password")}</label>
      <input
        type="password"
        value={oldPw}
        onChange={(e) => setOldPw(e.target.value)}
        className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none"
      />
      <label className="mb-1.5 mt-3.5 block text-sm text-gray-600">{t("新密码 (至少4位)", "New Password (at least 4 characters)")}</label>
      <input
        type="password"
        value={newPw}
        onChange={(e) => setNewPw(e.target.value)}
        className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none"
      />
      <label className="mb-1.5 mt-3.5 block text-sm text-gray-600">{t("再输一次", "Confirm New Password")}</label>
      <input
        type="password"
        value={newPw2}
        onChange={(e) => setNewPw2(e.target.value)}
        className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none"
      />
      <button
        onClick={submit}
        disabled={loading}
        className="mt-4 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:bg-violet-300"
      >
        {t("确定", "Confirm")}
      </button>
    </Modal>
  );
}
