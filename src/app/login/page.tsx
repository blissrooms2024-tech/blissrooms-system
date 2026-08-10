"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ROLE_HOME } from "@/lib/roleHome";
import ForgotPasswordModal from "./ForgotPasswordModal";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  async function doLogin(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError("请填 Email 和密码");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.message || "登录失败");
        setLoading(false);
        return;
      }
      router.push(ROLE_HOME[data.user.role] ?? "/login");
      router.refresh();
    } catch {
      setError("系统出错，请稍后再试");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand p-5">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl">
        <div className="text-center text-2xl font-bold text-brand">🏠 Bliss Rooms</div>
        <div className="mb-6 text-center text-sm text-gray-400">租房管理系统</div>

        <form onSubmit={doLogin}>
          <label className="mb-1.5 mt-3 block text-sm text-gray-600">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@bliss.com"
            className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none"
          />
          <label className="mb-1.5 mt-3.5 block text-sm text-gray-600">密码 Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••"
            className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none"
          />
          <button
            type="submit"
            disabled={loading}
            className="mt-5 w-full rounded-lg bg-brand py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:bg-blue-300"
          >
            {loading ? "登录中..." : "登录 Login"}
          </button>
        </form>

        <div className="mt-3 text-center">
          <button
            onClick={() => setShowForgot(true)}
            className="text-sm text-brand hover:underline"
          >
            忘记密码 Forgot password?
          </button>
        </div>

        {error && (
          <div className="mt-3.5 rounded-lg bg-red-50 p-2.5 text-center text-sm text-red-600">
            {error}
          </div>
        )}
      </div>

      {showForgot && <ForgotPasswordModal onClose={() => setShowForgot(false)} />}
    </div>
  );
}
