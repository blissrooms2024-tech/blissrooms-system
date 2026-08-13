"use client";

import { useState } from "react";
import Modal from "./Modal";
import { useToast } from "./Toast";

export default function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [newPw2, setNewPw2] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (newPw.length < 4) {
      toast.warning("新密码至少4位");
      return;
    }
    if (newPw !== newPw2) {
      toast.warning("两次新密码不一样");
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
      toast.danger("系统出错，请稍后再试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <h3 className="text-lg font-bold text-brand">🔑 改密码</h3>
      <label className="mb-1.5 mt-3.5 block text-sm text-gray-600">旧密码</label>
      <input
        type="password"
        value={oldPw}
        onChange={(e) => setOldPw(e.target.value)}
        className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none"
      />
      <label className="mb-1.5 mt-3.5 block text-sm text-gray-600">新密码 (至少4位)</label>
      <input
        type="password"
        value={newPw}
        onChange={(e) => setNewPw(e.target.value)}
        className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none"
      />
      <label className="mb-1.5 mt-3.5 block text-sm text-gray-600">再输一次</label>
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
        确定
      </button>
    </Modal>
  );
}
