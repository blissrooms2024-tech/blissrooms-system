"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ROLE_HOME } from "@/lib/roleHome";
import { useToast } from "@/components/Toast";
import ForgotPasswordModal from "./ForgotPasswordModal";

export default function LoginPage() {
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  async function doLogin(e: FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      toast.warning("请填 Email 和密码");
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
        toast.danger(data.message || "登录失败");
        setLoading(false);
        return;
      }
      router.push(ROLE_HOME[data.user.role] ?? "/login");
      router.refresh();
    } catch {
      toast.danger("系统出错，请稍后再试");
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-brand via-brand to-fuchsia-700 p-5">
      <RoomsBackdrop />
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl">
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
            className="mt-5 w-full rounded-lg bg-brand py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:bg-violet-300"
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
      </div>

      {showForgot && <ForgotPasswordModal onClose={() => setShowForgot(false)} />}
    </div>
  );
}

function RoomsBackdrop() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full opacity-60"
      viewBox="0 0 1366 768"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="skyline" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.05" />
        </linearGradient>
        <linearGradient id="skylineFront" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.24" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.08" />
        </linearGradient>
      </defs>

      {/* far row of rooms */}
      <g fill="url(#skyline)">
        <rect x="40" y="360" width="170" height="408" rx="10" />
        <rect x="230" y="300" width="150" height="468" rx="10" />
        <rect x="400" y="400" width="130" height="368" rx="10" />
        <rect x="960" y="330" width="160" height="438" rx="10" />
        <rect x="1140" y="380" width="150" height="388" rx="10" />
      </g>

      {/* near row of rooms, slightly bigger + brighter, with lit windows */}
      <g fill="url(#skylineFront)">
        <rect x="90" y="470" width="220" height="298" rx="12" />
        <rect x="340" y="430" width="200" height="338" rx="12" />
        <rect x="570" y="500" width="230" height="268" rx="12" />
        <rect x="830" y="440" width="210" height="328" rx="12" />
        <rect x="1070" y="480" width="230" height="288" rx="12" />
      </g>

      {/* window grid on the near buildings, lit like a rented room at night */}
      <g fill="#fef3c7" opacity="0.85">
        {[
          [120, 500], [170, 500], [220, 500], [270, 500],
          [120, 550], [170, 550], [220, 550], [270, 550],
          [120, 600], [170, 600], [220, 600], [270, 600],
          [370, 460], [420, 460], [470, 460], [520, 460],
          [370, 510], [420, 510], [470, 510], [520, 510],
          [370, 560], [420, 560], [470, 560], [520, 560],
          [600, 530], [650, 530], [700, 530], [750, 530],
          [600, 580], [650, 580], [700, 580], [750, 580],
          [860, 470], [910, 470], [960, 470], [1010, 470],
          [860, 520], [910, 520], [960, 520], [1010, 520],
          [1100, 510], [1150, 510], [1200, 510], [1250, 510],
          [1100, 560], [1150, 560], [1200, 560], [1250, 560],
        ].map(([x, y], i) => (
          <rect key={i} x={x} y={y} width="22" height="26" rx="3" opacity={0.35 + ((i * 37) % 50) / 100} />
        ))}
      </g>

      {/* rooftop roomline / a couple of pitched-roof houses for variety */}
      <g fill="url(#skylineFront)">
        <path d="M60 470 L145 400 L230 470 Z" />
        <path d="M1200 480 L1270 420 L1340 480 Z" />
      </g>
    </svg>
  );
}
