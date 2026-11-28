"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ActionTile from "@/components/ActionTile";
import ChangePasswordModal from "@/components/ChangePasswordModal";
import { useLanguage } from "@/components/LanguageProvider";
import { useToast } from "@/components/Toast";
import { IconBank, IconChevronRight, IconCopy, IconGlobe, IconLock, IconLogout, IconUser } from "@/components/icons";
import { NAV_GROUPS, navMeta, plainLabel, TONE_CLASS, type NavGroup, type NavIcon } from "@/components/navMeta";
import { MENUS } from "@/lib/menus";
import { COMPANY, ROLE_LABELS } from "@/lib/config";
import { SupportList } from "@/components/SupportContact";

type User = { name: string; email: string; role: string; userCode: string };

function Row({ icon: Icon, label, href, onClick, right }: { icon: NavIcon; label: string; href?: string; onClick?: () => void; right?: ReactNode }) {
  const body = (
    <>
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${TONE_CLASS.slate}`}>
        <Icon size={19} />
      </span>
      <span className="min-w-0 flex-1 text-sm text-gray-800">{label}</span>
      {right ?? <IconChevronRight size={18} className="text-gray-300" />}
    </>
  );
  const cls = "flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50";
  if (href)
    return (
      <Link href={href} className={cls}>
        {body}
      </Link>
    );
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={cls}>
        {body}
      </button>
    );
  return <div className={cls}>{body}</div>;
}

export default function MoreClient({ user }: { user: User }) {
  const { t, locale, setLocale } = useLanguage();
  const toast = useToast();
  const router = useRouter();
  const [showPw, setShowPw] = useState(false);
  const [badges, setBadges] = useState<Record<string, number>>({});

  const isTenant = user.role === "TENANT";

  useEffect(() => {
    let live = true;
    if (isTenant) {
      // Tenant: same red counts as the tab bar.
      Promise.all([
        fetch("/api/contracts/my-cards").then((r) => r.json()).catch(() => null),
        fetch("/api/contracts/warning-summary").then((r) => r.json()).catch(() => null),
      ]).then(([c, w]) => {
        if (!live) return;
        const cards: { unpaidBillCount: number; openMaintenanceCount: number; agentSigned: boolean; tenantSigned: boolean; isLegacy: boolean }[] =
          c?.success ? c.cards : [];
        setBadges({
          "/my-bills": cards.reduce((n, x) => n + x.unpaidBillCount, 0),
          "/my-maintenance": cards.reduce((n, x) => n + x.openMaintenanceCount, 0),
          "/my-tenancy": cards.filter((x) => !x.isLegacy && x.agentSigned && !x.tenantSigned).length,
          "/my-warnings": w?.success ? w.count : 0,
        });
      });
      return () => {
        live = false;
      };
    }
    Promise.all([
      fetch("/api/admin/sidebar-alerts").then((r) => r.json()).catch(() => null),
      fetch("/api/maintenance/summary").then((r) => r.json()).catch(() => null),
    ]).then(([a, m]) => {
      if (!live) return;
      setBadges({
        "/contracts": a?.success ? a.pendingApprove : 0,
        "/payments/review": a?.success ? a.pendingReview : 0,
        "/users": a?.success ? a.pendingUsers : 0,
        "/claims": a?.success ? a.pendingClaims : 0,
        "/maintenance": m?.success ? m.openCount : 0,
      });
    });
    return () => {
      live = false;
    };
  }, [isTenant]);

  const items = (MENUS[user.role] ?? []).filter((m) => m.href !== "/dashboard" && m.href !== "/my-home");
  const groups = NAV_GROUPS.map((g) => ({ ...g, items: items.filter((m) => navMeta(m.href).group === g.key) })).filter((g) => g.items.length);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  async function copyBank() {
    try {
      await navigator.clipboard.writeText(`${COMPANY.NAME}\n${COMPANY.BANK}\n${COMPANY.ACC_NO}`);
      toast.success(t("户口资料已复制", "Bank details copied"));
    } catch {
      toast.warning(t("复制失败，请手动复制", "Couldn't copy — please copy it manually"));
    }
  }

  const groupTitle = (key: NavGroup) => {
    const g = NAV_GROUPS.find((x) => x.key === key)!;
    return t(g.zh, g.en);
  };

  return (
    <div className="app-type mx-auto max-w-xl space-y-5">
      <Link href="/profile" className="flex items-center gap-3.5 rounded-3xl bg-white p-4 shadow-sm hover:bg-gray-50">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-brand font-display text-2xl font-semibold text-white">
          {user.name.trim().charAt(0).toUpperCase() || "?"}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base font-semibold text-gray-900">{user.name}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
            <span className="rounded-full bg-brand-light px-2 py-0.5 font-medium text-brand">{ROLE_LABELS[user.role] ?? user.role}</span>
            <span className="font-display">{user.userCode}</span>
          </span>
          {user.email && <span className="mt-0.5 block truncate text-xs text-gray-400">{user.email}</span>}
        </span>
        <IconChevronRight size={20} className="shrink-0 text-gray-300" />
      </Link>

      {groups.map((g) => (
        <section key={g.key}>
          <h2 className="mb-1.5 px-1 text-sm font-semibold text-gray-500">{groupTitle(g.key)}</h2>
          <div className="grid grid-cols-4 gap-x-1 gap-y-2 rounded-3xl bg-white p-2 shadow-sm sm:grid-cols-5">
            {g.items.map((m) => {
              const meta = navMeta(m.href);
              return (
                <ActionTile
                  key={m.href}
                  href={m.href}
                  icon={meta.icon}
                  tone={meta.tone}
                  label={plainLabel(locale === "en" ? m.labelEn : m.label)}
                  badge={badges[m.href]}
                />
              );
            })}
          </div>
        </section>
      ))}

      {isTenant && (
        <section>
          <h2 className="mb-1.5 px-1 text-sm font-semibold text-gray-500">{t("联系客服", "Contact support")}</h2>
          <div className="rounded-3xl bg-white p-3 shadow-sm">
            <SupportList compact />
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-1.5 px-1 text-sm font-semibold text-gray-500">{t("设置", "Settings")}</h2>
        <div className="divide-y divide-gray-100 overflow-hidden rounded-3xl bg-white shadow-sm">
          <Row icon={IconUser} label={t("我的资料", "My profile")} href="/profile" />
          <Row icon={IconLock} label={t("修改密码", "Change password")} onClick={() => setShowPw(true)} />
          <Row
            icon={IconGlobe}
            label={t("语言", "Language")}
            right={
              <span className="flex rounded-xl bg-gray-100 p-0.5 text-xs font-semibold">
                {(["zh", "en"] as const).map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLocale(l)}
                    aria-pressed={locale === l}
                    className={`rounded-[10px] px-3 py-1.5 ${locale === l ? "bg-white text-brand shadow-sm" : "text-gray-500"}`}
                  >
                    {l === "zh" ? "中文" : "English"}
                  </button>
                ))}
              </span>
            }
          />
          <div className="flex items-start gap-3 px-4 py-3">
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${TONE_CLASS.slate}`}>
              <IconBank size={19} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm text-gray-800">{t("公司户口", "Company bank account")}</span>
              <span className="mt-1 block text-xs leading-relaxed text-gray-500">
                {COMPANY.NAME}
                <br />
                {COMPANY.BANK}
                <br />
                <span className="font-display text-sm font-semibold tracking-wide text-gray-900">{COMPANY.ACC_NO}</span>
              </span>
            </span>
            <button type="button" onClick={copyBank} className="flex shrink-0 items-center gap-1 rounded-xl bg-brand-light px-3 py-2 text-xs font-semibold text-brand">
              <IconCopy size={15} />
              {t("复制", "Copy")}
            </button>
          </div>
        </div>
      </section>

      <button
        type="button"
        onClick={logout}
        className="flex w-full items-center justify-center gap-2 rounded-3xl bg-white py-3.5 text-sm font-semibold text-rose-600 shadow-sm hover:bg-rose-50"
      >
        <IconLogout size={18} />
        {t("登出", "Log out")}
      </button>

      <p className="pb-2 text-center text-xs text-gray-400">
        {COMPANY.NAME} · {COMPANY.REG_NO}
      </p>

      {showPw && <ChangePasswordModal onClose={() => setShowPw(false)} />}
    </div>
  );
}
