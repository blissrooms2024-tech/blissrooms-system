"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ROLE_HOME } from "@/lib/roleHome";
import { useToast } from "@/components/Toast";
import { useLanguage } from "@/components/LanguageProvider";
import LanguageToggle from "@/components/LanguageToggle";
import ForgotPasswordModal from "./ForgotPasswordModal";

export default function LoginPage() {
  const router = useRouter();
  const toast = useToast();
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  async function doLogin(e: FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      toast.warning(t("请填 Email 和密码", "Please enter your Email and password"));
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
        toast.danger(data.message || t("登录失败", "Login failed"));
        setLoading(false);
        return;
      }
      router.push(ROLE_HOME[data.user.role] ?? "/login");
      router.refresh();
    } catch {
      toast.danger(t("系统出错，请稍后再试", "System error — please try again later"));
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-violet-100 via-fuchsia-50 to-violet-100 p-5">
      <RoomsBackdrop />
      <LanguageToggle className="absolute right-4 top-4 z-10 !bg-white !text-gray-600 shadow-sm ring-1 ring-black/5 hover:!bg-gray-100" />
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl ring-1 ring-black/5">
        <div className="text-center text-2xl font-bold text-brand">🏠 Bliss Rooms</div>
        <div className="mb-6 text-center text-sm text-gray-400">{t("租房管理系统", "Rental Management System")}</div>

        <form onSubmit={doLogin}>
          <label className="mb-1.5 mt-3 block text-sm text-gray-600">{t("用户名 / Email", "Username / Email")}</label>
          <input
            type="text"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@bliss.com"
            className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none"
          />
          <label className="mb-1.5 mt-3.5 block text-sm text-gray-600">{t("密码", "Password")}</label>
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
            className="mt-5 w-full rounded-lg bg-brand py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:bg-violet-300"
          >
            {loading ? t("登录中...", "Logging in...") : t("登录", "Login")}
          </button>
        </form>

        <div className="mt-3 text-center">
          <button
            onClick={() => setShowForgot(true)}
            className="text-sm text-brand hover:underline"
          >
            {t("忘记密码？", "Forgot password?")}
          </button>
        </div>
        <div className="mt-2 text-center text-sm text-gray-500">
          {t("我是 Agent，还没有账号？", "I'm an Agent without an account yet?")}{" "}
          <Link href="/signup" className="text-brand hover:underline">
            {t("注册", "Sign Up")}
          </Link>
        </div>
      </div>

      {showForgot && <ForgotPasswordModal onClose={() => setShowForgot(false)} />}
    </div>
  );
}

const ROOM_PHOTOS = [
  "/login-bg/room-1.jpg",
  "/login-bg/room-2.jpg",
  "/login-bg/room-3.jpg",
  "/login-bg/room-4.jpg",
];

function RoomsBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-3 p-3 sm:gap-4 sm:p-5">
        {ROOM_PHOTOS.map((src) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={src}
            src={src}
            alt=""
            className="h-full w-full rounded-2xl object-cover shadow-md"
          />
        ))}
      </div>
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at center, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.55) 26%, rgba(245,243,255,0.25) 45%, rgba(245,243,255,0.08) 65%)",
        }}
      />
    </div>
  );
}
