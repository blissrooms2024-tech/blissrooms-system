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
  const [menuOpen, setMenuOpen] = useState(false);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const menu = MENUS[user.role] ?? [];

  const sidebarLinks = menu.map((m) => {
    const active = pathname === m.href || pathname.startsWith(m.href + "/");
    return (
      <Link
        key={m.href}
        href={m.href}
        onClick={() => setMenuOpen(false)}
        className={`block border-l-[3px] px-5 py-3 text-sm ${
          active
            ? "border-brand bg-brand-light font-semibold text-brand"
            : "border-transparent text-gray-700 hover:bg-gray-50"
        }`}
      >
        {m.label}
      </Link>
    );
  });

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-20 flex items-center justify-between gap-2 bg-brand px-3 py-3 text-white sm:px-5">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => setMenuOpen(true)}
            aria-label="打开菜单"
            className="rounded-lg p-1.5 hover:bg-white/15 md:hidden"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
            </svg>
          </button>
          <span className="truncate text-sm sm:text-base">
            🏠 <b>Bliss Rooms</b>
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 text-sm sm:gap-3">
          <span className="hidden truncate md:inline">你好, {user.name}</span>
          <span className="hidden rounded-full bg-white/20 px-2.5 py-0.5 text-xs sm:inline">
            {ROLE_LABELS[user.role] ?? user.role}
          </span>
          <button
            onClick={() => setShowChangePw(true)}
            className="rounded-lg bg-white/15 px-2.5 py-1.5 text-xs font-semibold hover:bg-white/25 sm:px-3"
          >
            改密码
          </button>
          <button
            onClick={logout}
            className="rounded-lg bg-white/15 px-2.5 py-1.5 text-xs font-semibold hover:bg-white/25 sm:px-3"
          >
            登出
          </button>
        </div>
      </div>

      {!user.verified && (
        <div className="border-b border-yellow-400 bg-yellow-50 px-3 py-2.5 text-center text-sm text-yellow-800 sm:px-5">
          ⚠️ 你的邮箱还没验证。请检查邮件点验证链接（或叫 Admin 重发）。
        </div>
      )}

      <div className="flex min-h-[calc(100vh-48px)]">
        <div className="hidden w-[190px] shrink-0 border-r border-gray-200 bg-white py-3.5 md:block">
          {sidebarLinks}
        </div>

        {menuOpen && (
          <div className="fixed inset-0 z-30 md:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setMenuOpen(false)} />
            <div className="absolute inset-y-0 left-0 w-[230px] overflow-y-auto bg-white py-3.5 shadow-xl">
              <div className="flex items-center justify-between px-5 pb-3">
                <span className="text-sm font-semibold text-brand">🏠 Bliss Rooms</span>
                <button
                  onClick={() => setMenuOpen(false)}
                  aria-label="关闭菜单"
                  className="rounded-lg p-1 text-gray-500 hover:bg-gray-100"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
              {sidebarLinks}
            </div>
          </div>
        )}

        <div className="min-w-0 flex-1 overflow-x-auto p-3 sm:p-5">{children}</div>
      </div>

      {showChangePw && <ChangePasswordModal onClose={() => setShowChangePw(false)} />}
    </div>
  );
}
