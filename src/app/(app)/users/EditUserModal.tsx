"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { ROLE_LABELS, userStatusLabel } from "@/lib/config";
import { useLanguage } from "@/components/LanguageProvider";

export interface EditableUser {
  userCode: string;
  name: string;
  email: string;
  role: string;
  phone: string | null;
  ic: string | null;
  commRate: number | null;
  bankName: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
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
  const { locale, t } = useLanguage();
  const [form, setForm] = useState({
    name: user.name,
    email: user.email,
    phone: user.phone || "",
    ic: user.ic || "",
    role: user.role,
    status: user.status,
    commRate: user.commRate ?? "",
    bankName: user.bankName || "",
    bankAccountName: user.bankAccountName || "",
    bankAccountNumber: user.bankAccountNumber || "",
    newPassword: "",
  });
  const [loading, setLoading] = useState(false);

  async function save() {
    if (form.newPassword && form.newPassword.length < 4) {
      toast.warning(t("新密码至少要4位", "New password must be at least 4 characters"));
      return;
    }
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
      toast.danger(t("系统出错，请稍后再试", "System error — please try again later"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <h3 className="text-lg font-bold text-brand">
        ✏️ {t("编辑用户", "Edit User")}
      </h3>
      <div className="mt-3.5 flex flex-wrap gap-2.5">
        <Field label={t("姓名", "Name")}>
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Email">
          <input className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-2.5">
        <Field label={t("电话", "Phone")}>
          <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </Field>
        <Field label="IC">
          <input className="input" value={form.ic} onChange={(e) => setForm({ ...form, ic: e.target.value })} />
        </Field>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-2.5">
        <Field label={t("角色", "Role")}>
          <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            {Object.entries(ROLE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("状态", "Status")}>
          <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="ACTIVE">{userStatusLabel("ACTIVE", locale)}</option>
            <option value="DISABLED">{userStatusLabel("DISABLED", locale)}</option>
            <option value="PENDING">{userStatusLabel("PENDING", locale)}</option>
          </select>
        </Field>
        <Field label={t("佣金率", "Commission Rate")}>
          <input
            type="number"
            step="0.01"
            className="input"
            value={form.commRate}
            onChange={(e) => setForm({ ...form, commRate: e.target.value === "" ? "" : Number(e.target.value) })}
          />
        </Field>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-2.5">
        <Field label={t("银行名称", "Bank Name")}>
          <input
            className="input"
            placeholder={t("例: Maybank", "e.g. Maybank")}
            value={form.bankName}
            onChange={(e) => setForm({ ...form, bankName: e.target.value })}
          />
        </Field>
        <Field label={t("户口名", "Account Name")}>
          <input
            className="input"
            value={form.bankAccountName}
            onChange={(e) => setForm({ ...form, bankAccountName: e.target.value })}
          />
        </Field>
        <Field label={t("户口号码", "Account Number")}>
          <input
            className="input"
            value={form.bankAccountNumber}
            onChange={(e) => setForm({ ...form, bankAccountNumber: e.target.value })}
          />
        </Field>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-2.5">
        <Field label={t("重设密码 (留空不改)", "Reset Password (leave blank to keep unchanged)")}>
          <input
            type="text"
            placeholder={t("新密码，至少4位", "New password, at least 4 characters")}
            className="input"
            value={form.newPassword}
            onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
          />
        </Field>
      </div>
      <button onClick={save} disabled={loading} className="btn-primary mt-4">
        {t("保存修改", "Save Changes")}
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
