"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ROLE_LABELS } from "@/lib/config";
import { useToast } from "@/components/Toast";

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
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  async function addUser(e: FormEvent) {
    e.preventDefault();
    if (!form.name || !form.email) {
      toast.warning("姓名和 Email 一定要填");
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
      toast.danger("系统出错，请稍后再试");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-xl bg-white p-5 shadow-sm">
        <div className="mb-3.5 flex items-center justify-between">
          <h3 className="text-base font-semibold text-brand">➕ 加新用户</h3>
          <Link href="/users" className="text-sm text-gray-500 hover:underline">
            ← 返回用户清单
          </Link>
        </div>

        <form onSubmit={addUser} className="space-y-5">
          <section>
            <h4 className="mb-2.5 text-sm font-semibold text-gray-500">基本资料</h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="姓名">
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
              <Field label="电话">
                <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </Field>
              <Field label="IC">
                <input className="input" value={form.ic} onChange={(e) => setForm({ ...form, ic: e.target.value })} />
              </Field>
            </div>
          </section>

          <section>
            <h4 className="mb-2.5 text-sm font-semibold text-gray-500">角色与登入</h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="角色">
                <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  {Object.entries(ROLE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="初始密码">
                <input
                  className="input"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </Field>
              {form.role === "AGENT" && (
                <Field label="佣金率(例0.5)">
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
            <h4 className="mb-2.5 text-sm font-semibold text-gray-500">银行资料 (选填，佣金/工钱用)</h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="银行名称">
                <input
                  className="input"
                  placeholder="例: Maybank"
                  value={form.bankName}
                  onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                />
              </Field>
              <Field label="户口名">
                <input
                  className="input"
                  value={form.bankAccountName}
                  onChange={(e) => setForm({ ...form, bankAccountName: e.target.value })}
                />
              </Field>
              <Field label="户口号码">
                <input
                  className="input"
                  value={form.bankAccountNumber}
                  onChange={(e) => setForm({ ...form, bankAccountNumber: e.target.value })}
                />
              </Field>
            </div>
          </section>

          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? "建立中..." : "建立用户"}
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
