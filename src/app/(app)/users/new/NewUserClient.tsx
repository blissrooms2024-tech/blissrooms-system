"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ROLE_LABELS } from "@/lib/config";
import { useToast } from "@/components/Toast";
import { useT } from "@/components/LanguageProvider";

const emptyForm = {
  name: "",
  email: "",
  role: "AGENT",
  phone: "",
  ic: "",
  password: "1234",
  commRate: "0.5",
  bankName: "",
  bankAccountName: "",
  bankAccountNumber: "",
};

export default function NewUserClient() {
  const router = useRouter();
  const toast = useToast();
  const t = useT();
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  async function addUser(e: FormEvent) {
    e.preventDefault();
    if (!form.name || !form.email) {
      toast.warning(t("姓名和 Email 一定要填", "Name and Email are required"));
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        router.push("/users");
      } else {
        toast.danger(data.message);
      }
    } catch {
      toast.danger(t("系统出错，请稍后再试", "System error — please try again later"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-xl bg-white p-5 shadow-sm">
        <div className="mb-3.5 flex items-center justify-between">
          <h3 className="text-base font-semibold text-brand">➕ {t("加新用户", "Add User")}</h3>
          <Link href="/users" className="text-sm text-gray-500 hover:underline">
            ← {t("返回用户清单", "Back to User List")}
          </Link>
        </div>

        <form onSubmit={addUser} className="space-y-5">
          <section>
            <h4 className="mb-2.5 text-sm font-semibold text-gray-500">{t("基本资料", "Basic Information")}</h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={t("姓名", "Name")}>
                <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
              <Field label="Email">
                <input
                  type="email"
                  className="input"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
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
            <h4 className="mb-2.5 text-sm font-semibold text-gray-500">{t("角色与登入", "Role & Login")}</h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label={t("角色", "Role")}>
                <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  {Object.entries(ROLE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("初始密码", "Initial Password")}>
                <input
                  className="input"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </Field>
              {form.role === "AGENT" && (
                <Field label={t("佣金率(例0.5)", "Commission Rate (e.g. 0.5)")}>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    value={form.commRate}
                    onChange={(e) => setForm({ ...form, commRate: e.target.value })}
                  />
                </Field>
              )}
            </div>
          </section>

          <section>
            <h4 className="mb-2.5 text-sm font-semibold text-gray-500">
              {t("银行资料 (选填，佣金/工钱用)", "Bank Details (optional, for commission/salary payouts)")}
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
            {submitting ? t("建立中...", "Creating...") : t("建立用户", "Create User")}
          </button>
        </form>
      </div>
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
