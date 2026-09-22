"use client";

import { useEffect, useState, FormEvent } from "react";
import { ROLE_LABELS } from "@/lib/config";
import { useToast } from "@/components/Toast";
import { useT } from "@/components/LanguageProvider";

export default function ProfileClient() {
  const toast = useToast();
  const t = useT();
  const [loaded, setLoaded] = useState(false);
  const [readOnly, setReadOnly] = useState({ userCode: "", email: "", role: "" });
  const [form, setForm] = useState({
    name: "",
    phone: "",
    ic: "",
    bankName: "",
    bankAccountName: "",
    bankAccountNumber: "",
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/profile");
      const data = await res.json();
      if (data.success) {
        const p = data.profile;
        setReadOnly({ userCode: p.userCode, email: p.email, role: p.role });
        setForm({
          name: p.name,
          phone: p.phone || "",
          ic: p.ic || "",
          bankName: p.bankName || "",
          bankAccountName: p.bankAccountName || "",
          bankAccountNumber: p.bankAccountNumber || "",
        });
        setLoaded(true);
      }
    })();
  }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.warning(t("姓名一定要填", "Name is required"));
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
      } else {
        toast.danger(data.message);
      }
    } catch {
      toast.danger(t("系统出错，请稍后再试", "System error — please try again later"));
    } finally {
      setSubmitting(false);
    }
  }

  if (!loaded) return <div className="rounded-xl bg-white p-5 text-sm text-gray-500 shadow-sm">{t("载入中...", "Loading...")}</div>;

  return (
    <div className="mx-auto max-w-2xl rounded-xl bg-white p-5 shadow-sm">
      <h3 className="mb-3.5 text-base font-semibold text-brand">{t("👤 我的资料", "👤 My Profile")}</h3>

      <div className="mb-3.5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t("用户编号", "User Code")}>
          <div className="input bg-gray-50 text-gray-500">{readOnly.userCode}</div>
        </Field>
        <Field label={t("角色", "Role")}>
          <div className="input bg-gray-50 text-gray-500">{ROLE_LABELS[readOnly.role] ?? readOnly.role}</div>
        </Field>
        <Field label="Email">
          <div className="input bg-gray-50 text-gray-500">{readOnly.email}</div>
        </Field>
      </div>
      <p className="mb-3.5 text-xs text-gray-400">
        {t("Email/角色需要 Admin 才能改，其他资料可以自己改。", "Email/Role can only be changed by Admin — everything else you can edit yourself.")}
      </p>

      <form onSubmit={save} className="space-y-5">
        <section>
          <h4 className="mb-2.5 text-sm font-semibold text-gray-500">{t("基本资料", "Basic Info")}</h4>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t("姓名", "Name")}>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label={t("电话", "Phone")}>
              <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field label="IC">
              <input className="input" value={form.ic} onChange={(e) => setForm({ ...form, ic: e.target.value })} />
            </Field>
          </div>
        </section>

        <section>
          <h4 className="mb-2.5 text-sm font-semibold text-gray-500">
            {t("银行资料", "Bank Details")} {readOnly.role === "TENANT" ? t("(退还押金用)", "(for deposit refund)") : t("(佣金/工钱用)", "(for commission/wages)")}
          </h4>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
        </section>

        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? t("保存中...", "Saving...") : t("保存修改", "Save Changes")}
        </button>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm text-gray-600">{label}</label>
      {children}
    </div>
  );
}
