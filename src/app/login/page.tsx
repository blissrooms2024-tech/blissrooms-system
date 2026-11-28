"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ROLE_HOME } from "@/lib/roleHome";
import { useToast } from "@/components/Toast";
import { useLanguage } from "@/components/LanguageProvider";
import LanguageToggle from "@/components/LanguageToggle";
import { IconEye, IconEyeOff, IconHome, IconLock, IconMail } from "@/components/icons";
import ForgotPasswordModal from "./ForgotPasswordModal";
import { SupportList } from "@/components/SupportContact";

export default function LoginPage() {
  const router = useRouter();
  const toast = useToast();
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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

  // Inputs stay at 16px: iPhone Safari zooms the whole page into any smaller input on focus.
  const inputCls =
    "w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-11 text-base text-gray-900 placeholder:text-gray-400 focus:border-brand focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand/10";

  return (
    <div className="app-type relative flex min-h-dvh flex-col bg-white md:items-center md:justify-center md:bg-violet-50 md:p-5">
      <div className="hidden md:block">
        <RoomsBackdrop />
      </div>
      <LanguageToggle className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] z-20 !bg-black/30 !text-white backdrop-blur hover:!bg-black/40 md:!bg-white md:!text-gray-600 md:shadow-sm md:ring-1 md:ring-black/5 md:backdrop-blur-none md:hover:!bg-gray-100" />

      {/* Phone: one of our own rooms across the top, the form sliding up over it like an app sheet */}
      <div className="relative h-[36dvh] min-h-[230px] shrink-0 md:hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/login-bg/room-2.jpg" alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#4c1d95]/85 via-[#4c1d95]/25 to-black/10" />
        <div className="absolute bottom-11 left-6 right-6 text-white">
          <Brand light />
        </div>
        <details className="mt-4 rounded-lg border border-gray-200 px-3 py-2 text-sm">
          <summary className="cursor-pointer py-1 font-semibold text-gray-600">
            🎧 {t("登录不了 / 需要帮忙？联系客服", "Can't log in / need help? Contact support")}
          </summary>
          <div className="mt-2">
            <SupportList compact />
          </div>
        </details>
      </div>

      <main className="relative -mt-7 flex-1 rounded-t-[28px] bg-white px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-7 md:mt-0 md:w-full md:max-w-[400px] md:flex-none md:rounded-[28px] md:p-8 md:shadow-2xl md:ring-1 md:ring-black/5">
        <div className="mb-6 hidden md:block">
          <Brand />
        </div>
        <h1 className="text-xl font-semibold text-gray-900">{t("欢迎回来", "Welcome back")}</h1>
        <p className="mt-0.5 text-sm text-gray-500">{t("登录 Bliss Rooms 租房管理系统", "Log in to the Bliss Rooms rental system")}</p>

        <form onSubmit={doLogin} className="mt-6 space-y-4">
          <div>
            <label htmlFor="login-email" className="mb-1.5 block text-sm font-medium text-gray-700">
              {t("用户名 / Email", "Username / Email")}
            </label>
            <div className="relative">
              <IconMail size={19} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                id="login-email"
                type="text"
                inputMode="email"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@bliss.com"
                className={`${inputCls} pr-3.5`}
              />
            </div>
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="login-password" className="block text-sm font-medium text-gray-700">
                {t("密码", "Password")}
              </label>
              <button type="button" onClick={() => setShowForgot(true)} className="text-sm font-medium text-brand hover:underline">
                {t("忘记密码？", "Forgot password?")}
              </button>
            </div>
            <div className="relative">
              <IconLock size={19} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••"
                className={`${inputCls} pr-12`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? t("隐藏密码", "Hide password") : t("显示密码", "Show password")}
                aria-pressed={showPassword}
                className="absolute right-1.5 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                {showPassword ? <IconEyeOff size={19} /> : <IconEye size={19} />}
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="!mt-6 w-full rounded-xl bg-brand py-3.5 text-base font-semibold text-white shadow-[0_12px_24px_-12px_rgba(109,40,217,0.7)] hover:bg-brand-dark disabled:bg-violet-300"
          >
            {loading ? t("登录中...", "Logging in...") : t("登录", "Log in")}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          {t("我是 Agent，还没有账号？", "I'm an Agent without an account yet?")}{" "}
          <Link href="/signup" className="font-medium text-brand hover:underline">
            {t("注册", "Sign up")}
          </Link>
        </p>
      </main>

      {showForgot && <ForgotPasswordModal onClose={() => setShowForgot(false)} />}
    </div>
  );
}

function Brand({ light = false }: { light?: boolean }) {
  const { t } = useLanguage();
  return (
    <div className="flex items-center gap-3">
      <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${light ? "bg-white/20 text-white backdrop-blur" : "bg-brand text-white"}`}>
        <IconHome size={26} />
      </span>
      <span>
        <span className={`block text-[28px] font-semibold leading-none tracking-tight ${light ? "text-white" : "text-gray-900"}`}>Bliss Rooms</span>
        <span className={`mt-1 block text-sm ${light ? "text-white/80" : "text-gray-500"}`}>{t("租房管理系统", "Rental Management System")}</span>
      </span>
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
