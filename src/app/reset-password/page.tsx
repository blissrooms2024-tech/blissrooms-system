"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function ResetPasswordForm() {
  const params = useSearchParams();
  const token = params.get("token") || "";
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (pw.length < 4) {
      setMessage("密码至少4位");
      return;
    }
    if (pw !== pw2) {
      setMessage("两次密码不一样");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: pw }),
      });
      const data = await res.json();
      setOk(!!data.success);
      setMessage(data.message);
    } catch {
      setMessage("系统出错，请稍后再试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand p-5">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl">
        <div className="text-center text-xl font-bold text-brand">🏠 Bliss Rooms</div>
        <div className="mb-5 text-center text-sm text-gray-400">重设密码 Reset Password</div>

        <label className="mb-1.5 block text-sm text-gray-600">新密码 New Password</label>
        <input type="password" className="input" placeholder="至少4位" value={pw} onChange={(e) => setPw(e.target.value)} />
        <label className="mb-1.5 mt-3.5 block text-sm text-gray-600">再输一次 Confirm</label>
        <input type="password" className="input" placeholder="再输一次" value={pw2} onChange={(e) => setPw2(e.target.value)} />

        <button onClick={submit} disabled={loading || ok} className="btn-primary mt-4.5 w-full">
          {ok ? "完成 ✓" : "确定 Reset"}
        </button>

        {message && (
          <div className={`mt-3.5 rounded-lg p-2.5 text-center text-sm ${ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
