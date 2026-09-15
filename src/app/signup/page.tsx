"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { useToast } from "@/components/Toast";

export default function SignupPage() {
  const toast = useToast();
  const [form, setForm] = useState({ name: "", email: "", phone: "", ic: "", password: "", confirmPassword: "" });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) {
      toast.warning("姓名/Email/密码一定要填");
      return;
    }
    if (form.password.length < 6) {
      toast.warning("密码至少要6位");
      return;
    }
    if (form.password !== form.confirmPassword) {
      toast.warning("两次密码不一样");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setDone(true);
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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-violet-100 via-fuchsia-50 to-violet-100 p-5">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl ring-1 ring-black/5">
        <div className="text-center text-2xl font-bold text-brand">🏠 Bliss Rooms</div>
        <div className="mb-6 text-center text-sm text-gray-400">Agent 注册</div>

        {done ? (
          <div className="rounded-lg bg-green-50 p-4 text-center text-sm text-green-700">
            ✅ 注册成功！请等 Admin 批准你的账号后才能登入，批准后会发邮件通知你。
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
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
            <Field label="电话 (选填)">
              <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field label="IC (选填)">
              <input className="input" value={form.ic} onChange={(e) => setForm({ ...form, ic: e.target.value })} />
            </Field>
            <Field label="密码 (至少6位)">
              <input
                type="password"
                className="input"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </Field>
            <Field label="确认密码">
              <input
                type="password"
                className="input"
                value={form.confirmPassword}
                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
              />
            </Field>
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? "注册中..." : "注册 Sign Up"}
            </button>
          </form>
        )}

        <div className="mt-3.5 text-center text-sm">
          <Link href="/login" className="text-brand hover:underline">
            已经有账号？登录
          </Link>
        </div>
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
