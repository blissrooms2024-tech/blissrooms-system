"use client";

import Link from "next/link";
import { useLanguage } from "@/components/LanguageProvider";

interface Box {
  n: string | number;
  l: string;
  lEn: string;
  href?: string;
}

export interface TodoItem {
  key: string;
  count: number;
  label: string;
  labelEn: string;
  sub?: string;
  subEn?: string;
  href: string;
  tone: "red" | "amber";
}

const TONE = {
  red: { num: "text-red-600", bar: "border-red-500" },
  amber: { num: "text-amber-600", bar: "border-amber-400" },
};

interface LeaderboardRow {
  userCode: string;
  name: string;
  total: number;
  thisMonth: number;
}

export default function DashboardClient({
  todos,
  revBoxes,
  roomBoxes,
  carparkBoxes,
  leaderboard,
}: {
  todos: TodoItem[];
  revBoxes: Box[];
  roomBoxes: Box[];
  carparkBoxes: Box[];
  leaderboard: LeaderboardRow[];
}) {
  const { locale, t } = useLanguage();
  const MEDAL = ["🥇", "🥈", "🥉"];

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white p-4 shadow-sm sm:p-5">
        <h3 className="mb-3 text-base font-semibold text-brand">✅ {t("今日待办", "Today's To-Do")}</h3>
        {todos.length === 0 ? (
          <div className="rounded-lg bg-gray-50 py-4 text-center text-sm text-gray-500">
            {t("今天没有待办，全部处理完了 👍", "Nothing waiting — all caught up 👍")}
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {todos.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className={`flex min-h-[52px] items-center gap-3 rounded-lg border-l-4 bg-gray-50 px-3 py-2.5 transition hover:bg-brand-light ${TONE[item.tone].bar}`}
              >
                <span className={`min-w-[2ch] text-2xl font-bold leading-none ${TONE[item.tone].num}`}>{item.count}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-gray-800">{locale === "en" ? item.labelEn : item.label}</span>
                  {item.sub && (
                    <span className="block text-xs text-gray-500">{locale === "en" ? item.subEn : item.sub}</span>
                  )}
                </span>
                <span className="text-gray-400" aria-hidden>
                  ›
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl bg-white p-5 shadow-sm">
        <h3 className="mb-3.5 text-base font-semibold text-brand">💰 {t("营业额", "Revenue")}</h3>
        <div className="flex flex-wrap gap-3.5">
          {revBoxes.map((b) => (
            <Link
              key={b.l}
              href={b.href!}
              className="min-w-[140px] flex-1 rounded-xl bg-gray-50 p-3.5 text-center transition hover:bg-brand-light"
            >
              <div className="text-2xl font-bold text-brand">{b.n}</div>
              <div className="text-xs text-gray-500">{locale === "en" ? b.lEn : b.l}</div>
            </Link>
          ))}
        </div>
      </div>

      <div className="rounded-xl bg-white p-5 shadow-sm">
        <h3 className="mb-3.5 text-base font-semibold text-brand">🏠 {t("房间总览", "Room Overview")}</h3>
        <div className="flex flex-wrap gap-3.5">
          {roomBoxes.map((b) => (
            <div key={b.l} className="min-w-[110px] flex-1 rounded-xl bg-gray-50 p-3.5 text-center">
              <div className="text-2xl font-bold text-brand">{b.n}</div>
              <div className="text-xs text-gray-500">{locale === "en" ? b.lEn : b.l}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-xl bg-white p-5 shadow-sm">
        <h3 className="mb-3.5 text-base font-semibold text-brand">🅿️ {t("车位总览", "Carpark Overview")}</h3>
        <div className="flex flex-wrap gap-3.5">
          {carparkBoxes.map((b) => (
            <div key={b.l} className="min-w-[110px] flex-1 rounded-xl bg-gray-50 p-3.5 text-center">
              <div className="text-2xl font-bold text-brand">{b.n}</div>
              <div className="text-xs text-gray-500">{locale === "en" ? b.lEn : b.l}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl bg-white p-5 shadow-sm">
        <h3 className="mb-3.5 text-base font-semibold text-brand">🏆 {t("Top Sales 排行榜", "Top Sales Leaderboard")}</h3>
        {leaderboard.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-400">{t("还没有成交记录", "No deals yet")}</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-gray-600">
                <th className="px-2.5 py-1.5 font-semibold">{t("排名", "Rank")}</th>
                <th className="px-2.5 py-1.5 font-semibold">Agent</th>
                <th className="px-2.5 py-1.5 font-semibold">{t("总成交合同", "Total Contracts")}</th>
                <th className="px-2.5 py-1.5 font-semibold">{t("本月新增", "This Month")}</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((a, i) => (
                <tr key={a.userCode} className="border-b border-gray-100">
                  <td className="px-2.5 py-1.5 font-semibold">{MEDAL[i] ?? `#${i + 1}`}</td>
                  <td className="px-2.5 py-1.5">{a.name}</td>
                  <td className="px-2.5 py-1.5 font-semibold text-brand">{a.total}</td>
                  <td className="px-2.5 py-1.5">{a.thisMonth}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
