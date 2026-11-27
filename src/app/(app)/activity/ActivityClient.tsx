"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { fmtDate } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/config";

interface Item {
  id: string;
  at: string;
  userName: string;
  role: string | null;
  method: string;
  area: string;
  target: string | null;
  summary: string;
}
type Range = "today" | "7d" | "30d" | "all";

const dayKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function ActivityClient() {
  const { t } = useLanguage();
  const [range, setRange] = useState<Range>("7d");
  const [userId, setUserId] = useState("");
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [people, setPeople] = useState<{ userId: string; userName: string; count: number }[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const params = useMemo(() => {
    const p = new URLSearchParams({ range });
    if (userId) p.set("userId", userId);
    if (query) p.set("q", query);
    return p.toString();
  }, [range, userId, query]);

  const load = useCallback(
    async (after?: string) => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/activity?${params}${after ? `&cursor=${after}` : ""}`);
        const d = await res.json();
        if (!d.success) return setError(d.message);
        setItems((prev) => (after ? [...prev, ...d.items] : d.items));
        setCursor(d.nextCursor);
        if (d.people) setPeople(d.people);
      } catch {
        setError(t("出错，请稍后再试", "Something went wrong — please try again later"));
      } finally {
        setLoading(false);
      }
    },
    [params, t]
  );

  useEffect(() => {
    // setState happens after the fetch's await, not synchronously in the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const today = dayKey(new Date().toISOString());
  const groups = useMemo(() => {
    const out: { day: string; items: Item[] }[] = [];
    for (const it of items) {
      const k = dayKey(it.at);
      if (!out.length || out[out.length - 1].day !== k) out.push({ day: k, items: [] });
      out[out.length - 1].items.push(it);
    }
    return out;
  }, [items]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white p-4 shadow-sm sm:p-5">
        <h3 className="mb-3 text-base font-semibold text-brand">🕘 {t("活动记录", "Activity log")}</h3>
        <p className="mb-3 text-xs text-gray-500">
          {t(
            "系统里每一个成功的改动都会记下：谁、什么时间、做了什么（新增、修改、删除、付款、审批…）。密码会自动遮掉。",
            "Every successful change is recorded: who, when and what (create, edit, delete, payments, approvals…). Passwords are masked."
          )}
        </p>
        <div className="mb-2 flex gap-1 overflow-x-auto">
          {(
            [
              ["today", t("今天", "Today")],
              ["7d", t("7 天", "7 days")],
              ["30d", t("30 天", "30 days")],
              ["all", t("全部", "All")],
            ] as const
          ).map(([k, lbl]) => (
            <button
              key={k}
              onClick={() => setRange(k)}
              className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-semibold ${range === k ? "bg-brand text-white" : "bg-brand-light text-brand"}`}
            >
              {lbl}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <select className="input" value={userId} onChange={(e) => setUserId(e.target.value)}>
            <option value="">{t("所有人", "Everyone")}</option>
            {people.map((p) => (
              <option key={p.userId} value={p.userId}>
                {p.userName} ({p.count})
              </option>
            ))}
          </select>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setQuery(q.trim());
            }}
          >
            <input
              className="input"
              type="search"
              placeholder={t("搜索：编号、单位、内容（按 Enter）", "Search code, unit, text (press Enter)")}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onBlur={() => setQuery(q.trim())}
            />
          </form>
        </div>
        {error && <div className="mt-2 text-sm text-red-600">{error}</div>}
      </div>

      {groups.length === 0 && !loading ? (
        <div className="rounded-xl bg-white p-8 text-center text-sm text-gray-400 shadow-sm">{t("没有记录", "No activity")}</div>
      ) : (
        groups.map((g) => (
          <div key={g.day} className="rounded-xl bg-white p-4 shadow-sm">
            <div className="mb-1 text-xs font-semibold text-gray-500">{g.day === today ? t("今天", "Today") : fmtDate(g.day)}</div>
            <div className="divide-y divide-gray-100 text-sm">
              {g.items.map((a) => {
                const d = new Date(a.at);
                const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
                return (
                  <div key={a.id} className="flex gap-3 py-2">
                    <span className="w-11 shrink-0 pt-0.5 text-xs text-gray-400">{hm}</span>
                    <div className="min-w-0">
                      <div className="text-xs text-gray-500">
                        <b className="text-gray-800">{a.userName}</b> · {ROLE_LABELS[a.role ?? ""] ?? a.role}
                      </div>
                      <div className="mt-0.5 break-words">
                        {a.method === "DELETE" && <span className="mr-1 rounded bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-700">{t("删除", "Deleted")}</span>}
                        <span className="mr-1 rounded bg-brand-light px-1.5 py-0.5 text-xs text-brand">{a.area}</span>
                        {a.summary}
                        {a.target && !a.summary.includes(a.target) && <span className="text-gray-400"> · {a.target}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

      {cursor && (
        <button onClick={() => load(cursor)} disabled={loading} className="btn-soft w-full py-2.5">
          {loading ? t("载入中…", "Loading…") : t("加载更多", "Load more")}
        </button>
      )}
    </div>
  );
}
