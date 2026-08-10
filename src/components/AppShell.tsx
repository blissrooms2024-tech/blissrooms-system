"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { MENUS } from "@/lib/menus";
import { ROLE_LABELS } from "@/lib/config";
import ChangePasswordModal from "./ChangePasswordModal";

export interface CurrentUser {
  userCode: string;
  name: string;
  email: string;
  role: string;
  verified: boolean;
}

export default function AppShell({
  user,
  children,
}: {
  user: CurrentUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [showChangePw, setShowChangePw] = useState(false);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const menu = MENUS[user.role] ?? [];

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-10 flex items-center justify-between bg-brand px-5 py-3 text-white">
        <div>
          🏠 <b>Bliss Rooms</b>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span>你好, {user.name}</span>
          <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs">
            {ROLE_LABELS[user.role] ?? user.role}
          </span>
          <button
            onClick={() => setShowChangePw(true)}
            className="rounded-lg bg-white/15 px-3 py-1.5 text-xs font-semibold hover:bg-white/25"
          >
            改密码
          </button>
          <button
            onClick={logout}
            className="rounded-lg bg-white/15 px-3 py-1.5 text-xs font-semibold hover:bg-white/25"
          >
            登出
          </button>
        </div>
      </div>

      {!user.verified && (
        <div className="border-b border-yellow-400 bg-yellow-50 px-5 py-2.5 text-center text-sm text-yellow-800">
          ⚠️ 你的邮箱还没验证。请检查邮件点验证链接（或叫 Admin 重发）。
        </div>
      )}

      <div className="flex min-h-[calc(100vh-48px)]">
        <div className="w-[190px] shrink-0 border-r border-gray-200 bg-white py-3.5">
          {menu.map((m) => {
            const active = pathname === m.href || pathname.startsWith(m.href + "/");
            return (
              <Link
                key={m.href}
                href={m.href}
                className={`block border-l-[3px] px-5 py-3 text-sm ${
                  active
                    ? "border-brand bg-brand-light font-semibold text-brand"
                    : "border-transparent text-gray-700 hover:bg-gray-50"
                }`}
              >
                {m.label}
              </Link>
            );
          })}
        </div>
        <div className="flex-1 overflow-x-auto p-5">{children}</div>
      </div>

      {showChangePw && <ChangePasswordModal onClose={() => setShowChangePw(false)} />}
    </div>
  );
}
