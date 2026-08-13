"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { ROLE_LABELS } from "@/lib/config";

export interface EditableUser {
  userCode: string;
  name: string;
  email: string;
  role: string;
  phone: string | null;
  ic: string | null;
  commRate: number | null;
  status: string;
}

export default function EditUserModal({
  user,
  onClose,
  onSaved,
}: {
  user: EditableUser;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState({
    name: user.name,
    email: user.email,
    phone: user.phone || "",
    ic: user.ic || "",
    role: user.role,
    status: user.status,
    commRate: user.commRate ?? "",
  });
  const [loading, setLoading] = useState(false);

  async function save() {
    setLoading(true);
    try {
      const res = await fetch(`/api/users/${user.userCode}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setTimeout(() => {
          onSaved();
          onClose();
        }, 800);
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
      <h3 className="text-lg font-bold text-brand">✏️ 编辑用户</h3>
      <div className="mt-3.5 flex flex-wrap gap-2.5">
        <Field label="姓名">
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Email">
          <input className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-2.5">
        <Field label="电话">
          <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </Field>
        <Field label="IC">
          <input className="input" value={form.ic} onChange={(e) => setForm({ ...form, ic: e.target.value })} />
        </Field>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-2.5">
        <Field label="角色">
          <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            {Object.entries(ROLE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <Field label="状态">
          <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="ACTIVE">Active</option>
            <option value="DISABLED">Disabled</option>
          </select>
        </Field>
        <Field label="佣金率">
          <input
            type="number"
            step="0.01"
            className="input"
            value={form.commRate}
            onChange={(e) => setForm({ ...form, commRate: e.target.value === "" ? "" : Number(e.target.value) })}
          />
        </Field>
      </div>
      <button onClick={save} disabled={loading} className="btn-primary mt-4">
        保存修改
      </button>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-[150px] flex-1">
      <label className="mb-1.5 block text-sm text-gray-600">{label}</label>
      {children}
    </div>
  );
}
