"use client";

import Link from "next/link";
import { useLanguage } from "@/components/LanguageProvider";

interface Box {
  n: string | number;
  l: string;
  lEn: string;
  href?: string;
}

interface LeaderboardRow {
  userCode: string;
  name: string;
  total: number;
  thisMonth: number;
}

export default function DashboardClient({
  revBoxes,
  roomBoxes,
  carparkBoxes,
  leaderboard,
}: {
  revBoxes: Box[];
  roomBoxes: Box[];
  carparkBoxes: Box[];
  leaderboard: LeaderboardRow[];
}) {
  const { locale, t } = useLanguage();
  const MEDAL = ["🥇", "🥈", "🥉"];

  return (
    <div className="space-y-4">
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
