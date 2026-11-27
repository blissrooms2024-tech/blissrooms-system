"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import ActionTile from "@/components/ActionTile";
import Sheet from "@/components/Sheet";
import { useLanguage } from "@/components/LanguageProvider";
import { IconArrowUp, IconMinus, IconPlus, IconSliders } from "@/components/icons";
import { navMeta, TONE_CLASS } from "@/components/navMeta";

/**
 * The home page's shortcut grid. Each person picks and orders their own (up to 8); the choice
 * is kept on this phone/browser only, so it costs nothing on the server and never affects
 * anyone else. Boss and Admin start from different defaults.
 */

type Action = { id: string; href?: string; meta: string; zh: string; en: string; adminOnly?: boolean };

export const ACTIONS: Action[] = [
  { id: "quote", meta: "/quote", zh: "快速报价", en: "Quick quote" },
  { id: "contract-new", href: "/contracts/new", meta: "/contracts/new", zh: "新合同", en: "New contract", adminOnly: true },
  { id: "bulk", href: "/payments/bulk", meta: "/payments/bulk", zh: "批量开账单", en: "Bulk billing", adminOnly: true },
  { id: "meter", href: "/utilities", meta: "/utilities", zh: "抄表开单", en: "Meter billing" },
  { id: "renewal", href: "/contracts/renewal", meta: "/contracts/renewal", zh: "续约管理", en: "Renewals", adminOnly: true },
  { id: "review", href: "/payments/review", meta: "/payments/review", zh: "交易单审核", en: "Slip review" },
  { id: "outstanding", href: "/payments/outstanding", meta: "/payments/outstanding", zh: "未清账单", en: "Outstanding" },
  { id: "maintenance", href: "/maintenance", meta: "/maintenance", zh: "报修", en: "Maintenance" },
  { id: "claims", href: "/claims", meta: "/claims", zh: "报销", en: "Claims" },
  { id: "pnl", href: "/pnl", meta: "/pnl", zh: "损益表", en: "P&L" },
  { id: "finance", href: "/finance", meta: "/finance", zh: "财务总览", en: "Finance" },
  { id: "utility", href: "/payments/utility-report", meta: "/payments/utility-report", zh: "水电报表", en: "Utilities" },
  { id: "units", href: "/units", meta: "/units", zh: "楼盘", en: "Properties" },
  { id: "rooms", href: "/rooms", meta: "/rooms", zh: "房间", en: "Rooms" },
  { id: "contracts", href: "/contracts", meta: "/contracts", zh: "合同", en: "Contracts" },
  { id: "vouchers", href: "/vouchers", meta: "/vouchers", zh: "代金券", en: "Vouchers" },
  { id: "warnings", href: "/warning-letters", meta: "/warning-letters", zh: "警告信", en: "Warnings" },
  { id: "commissions", href: "/agent-commissions", meta: "/agent-commissions", zh: "Agent 佣金", en: "Commissions" },
  { id: "activity", href: "/activity", meta: "/activity", zh: "活动记录", en: "Activity" },
  { id: "users", href: "/users", meta: "/users", zh: "用户", en: "Users", adminOnly: true },
];

const DEFAULTS: Record<string, string[]> = {
  ADMIN: ["quote", "contract-new", "meter", "review", "outstanding", "maintenance", "claims", "renewal"],
  BOSS: ["quote", "review", "outstanding", "maintenance", "claims", "pnl", "finance", "activity"],
};
const MAX = 8;
const CHANGE_EVENT = "quick-actions-change";

// Falls back to memory where storage is blocked (some private-browsing modes), so the
// customise sheet still works for the rest of the visit.
const memory = new Map<string, string>();
function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key) ?? memory.get(key) ?? null;
  } catch {
    return memory.get(key) ?? null;
  }
}
function write(key: string, value: string) {
  memory.set(key, value);
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* memory copy is enough for this visit */
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}
function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(CHANGE_EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(CHANGE_EVENT, cb);
  };
}

export default function QuickActions({
  role,
  userKey,
  badges,
  onQuote,
}: {
  role: string;
  userKey: string;
  badges: Record<string, number>;
  onQuote: () => void;
}) {
  const { t } = useLanguage();
  const [editing, setEditing] = useState(false);
  const storageKey = `bliss.quickActions.v1.${userKey}`;

  const available = useMemo(() => ACTIONS.filter((a) => !a.adminOnly || role === "ADMIN"), [role]);
  const defaults = DEFAULTS[role] ?? DEFAULTS.BOSS;
  const raw = useSyncExternalStore(
    subscribe,
    () => read(storageKey),
    () => null
  );
  const chosen = useMemo(() => {
    let ids: string[] = defaults;
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) ids = parsed.filter((x): x is string => typeof x === "string");
      } catch {
        /* keep defaults */
      }
    }
    return ids.map((id) => available.find((a) => a.id === id)).filter((a): a is Action => !!a).slice(0, MAX);
  }, [raw, available, defaults]);

  const save = (list: Action[]) => write(storageKey, JSON.stringify(list.map((a) => a.id)));
  const label = (a: Action) => t(a.zh, a.en);
  const rest = available.filter((a) => !chosen.includes(a));

  return (
    <section>
      <div className="mb-1 flex items-center justify-between px-1">
        <h2 className="text-[15px] font-semibold text-gray-900">{t("快捷功能", "Shortcuts")}</h2>
        <button type="button" onClick={() => setEditing(true)} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-brand hover:bg-white">
          <IconSliders size={15} />
          {t("自定义", "Customise")}
        </button>
      </div>
      {chosen.length === 0 ? (
        <button type="button" onClick={() => setEditing(true)} className="w-full rounded-2xl border border-dashed border-gray-300 py-5 text-sm text-gray-500">
          {t("点这里加入常用功能", "Tap to add the pages you use most")}
        </button>
      ) : (
        <div className="grid grid-cols-4 gap-x-1 gap-y-1 sm:grid-cols-8">
          {chosen.map((a) => {
            const m = navMeta(a.meta);
            return (
              <ActionTile
                key={a.id}
                href={a.href}
                onClick={a.id === "quote" ? onQuote : undefined}
                icon={m.icon}
                tone={m.tone}
                label={label(a)}
                badge={badges[a.id]}
                variant="raised"
              />
            );
          })}
        </div>
      )}

      <Sheet open={editing} onClose={() => setEditing(false)} title={t("自定义快捷功能", "Customise shortcuts")}>
        <p className="mb-3 text-xs text-gray-500">
          {t(`最多 ${MAX} 个，只保存在这部手机/电脑上。`, `Up to ${MAX}. Saved on this phone or computer only.`)}
        </p>
        <h3 className="mb-1 text-xs font-semibold text-gray-500">
          {t("已显示", "Showing")} · {chosen.length}/{MAX}
        </h3>
        <ul className="divide-y divide-gray-100">
          {chosen.map((a, i) => {
            const m = navMeta(a.meta);
            return (
              <li key={a.id} className="flex items-center gap-3 py-2">
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${TONE_CLASS[m.tone]}`}>
                  <m.icon size={19} />
                </span>
                <span className="min-w-0 flex-1 text-sm">{label(a)}</span>
                <button
                  type="button"
                  disabled={i === 0}
                  onClick={() => save([...chosen.slice(0, i - 1), a, chosen[i - 1], ...chosen.slice(i + 1)])}
                  aria-label={t("往前移", "Move up")}
                  className="grid h-9 w-9 place-items-center rounded-xl text-gray-500 hover:bg-gray-100 disabled:opacity-25"
                >
                  <IconArrowUp size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => save(chosen.filter((x) => x !== a))}
                  aria-label={t("移除", "Remove")}
                  className="grid h-9 w-9 place-items-center rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100"
                >
                  <IconMinus size={18} />
                </button>
              </li>
            );
          })}
        </ul>

        {rest.length > 0 && (
          <>
            <h3 className="mb-1 mt-4 text-xs font-semibold text-gray-500">{t("可以加入", "Add")}</h3>
            <ul className="divide-y divide-gray-100">
              {rest.map((a) => {
                const m = navMeta(a.meta);
                const full = chosen.length >= MAX;
                return (
                  <li key={a.id} className="flex items-center gap-3 py-2">
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${TONE_CLASS[m.tone]}`}>
                      <m.icon size={19} />
                    </span>
                    <span className="min-w-0 flex-1 text-sm">{label(a)}</span>
                    <button
                      type="button"
                      disabled={full}
                      onClick={() => save([...chosen, a])}
                      aria-label={t("加入", "Add")}
                      className="grid h-9 w-9 place-items-center rounded-xl bg-brand-light text-brand hover:bg-violet-100 disabled:opacity-30"
                    >
                      <IconPlus size={18} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => save(defaults.map((id) => available.find((a) => a.id === id)).filter((a): a is Action => !!a))} className="btn-soft py-2.5">
            {t("恢复默认", "Reset")}
          </button>
          <button type="button" onClick={() => setEditing(false)} className="btn-primary py-2.5">
            {t("完成", "Done")}
          </button>
        </div>
      </Sheet>
    </section>
  );
}
