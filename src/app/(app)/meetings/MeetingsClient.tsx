"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Pill from "@/components/Pill";
import { useLanguage } from "@/components/LanguageProvider";
import { IconChevronRight, IconNotes, IconPlus } from "@/components/icons";
import { timeText } from "@/lib/meetingText";
import type { IssueView, MeetingRow, Person } from "@/lib/meetings";
import { IssueCard, MeetingFormSheet, card } from "./ui";

type Tab = "meetings" | "mine" | "open";

const MONTH_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dayParts = (iso: string) => {
  const d = new Date(Date.parse(iso) + 8 * 3600_000);
  return { day: d.getUTCDate(), month: d.getUTCMonth() };
};

/** 会议记录 — every meeting I can see, the issues I handle or follow up, and what's still open. */
export default function MeetingsClient({ me, isManager, initialTab, openNew }: { me: string; isManager: boolean; initialTab: Tab; openNew: boolean }) {
  const { t } = useLanguage();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [data, setData] = useState<{ meetings: MeetingRow[]; mine: IssueView[]; open: IssueView[] } | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(openNew && isManager);

  const load = useCallback(async () => {
    try {
      const [d, p] = await Promise.all([fetch("/api/meetings").then((r) => r.json()), fetch("/api/meetings/people").then((r) => r.json())]);
      if (!d.success) return setError(d.message);
      setError("");
      setData(d);
      if (p.success) setPeople(p.people);
    } catch {
      setError(t("网络连接失败，请检查网络后重试", "Network connection failed — please try again"));
    }
  }, [t]);

  useEffect(() => {
    // Every setState in load() happens after the fetch's await, not synchronously in the effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  function pickTab(next: Tab) {
    setTab(next);
    window.history.replaceState(null, "", next === "meetings" ? "/meetings" : `/meetings?tab=${next}`);
  }

  const mineOpen = data?.mine.filter((i) => i.status === "OPEN").length ?? 0;
  const tabs: { key: Tab; zh: string; en: string; n?: number }[] = [
    { key: "meetings", zh: "会议", en: "Meetings" },
    { key: "mine", zh: "我的事项", en: "My items", n: mineOpen },
    { key: "open", zh: "还没完成", en: "Still open", n: data?.open.length },
  ];

  return (
    <div className="app-type mx-auto max-w-3xl space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{t("会议记录", "Meetings")}</h1>
          <p className="text-sm text-gray-500">{t("每个人用自己的账号写备注，合成当天的记录", "Everyone writes their own notes; together they're the record")}</p>
        </div>
        {isManager && (
          <button type="button" onClick={() => setCreating(true)} className="btn-primary flex shrink-0 items-center gap-1.5 px-4 py-2.5">
            <IconPlus size={18} />
            {t("新会议", "New")}
          </button>
        )}
      </div>

      <div role="tablist" className="flex rounded-2xl bg-white p-1 shadow-sm">
        {tabs.map((x) => (
          <button
            key={x.key}
            role="tab"
            aria-selected={tab === x.key}
            type="button"
            onClick={() => pickTab(x.key)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-sm font-medium ${tab === x.key ? "bg-brand text-white" : "text-gray-600 hover:bg-gray-50"}`}
          >
            {t(x.zh, x.en)}
            {!!x.n && <span className={`rounded-full px-1.5 text-[11px] ${tab === x.key ? "bg-white/25" : "bg-rose-50 text-rose-600"}`}>{x.n}</span>}
          </button>
        ))}
      </div>

      {error && <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
      {!data && !error && <div className="h-40 animate-pulse rounded-[20px] bg-white/80 motion-reduce:animate-none" />}

      {data && tab === "meetings" && (
        data.meetings.length === 0 ? (
          <div className={`${card} py-10 text-center`}>
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand-light text-brand">
              <IconNotes size={24} />
            </span>
            <p className="mt-3 font-medium text-gray-900">{t("还没有会议记录", "No meetings yet")}</p>
            <p className="mx-auto mt-1 max-w-xs text-sm text-gray-500">
              {isManager ? t("开会时按「新会议」，选参加的人，大家就可以用自己的账号写备注。", "Tap New when a meeting starts and pick who's there; each of them writes their own notes.") : t("Boss / Admin 把你加进会议后，会在这里出现。", "Meetings you're added to show up here.")}
            </p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {data.meetings.map((m) => {
              const d = dayParts(m.startsAt);
              return (
                <li key={m.code}>
                  <Link href={`/meetings/${m.code}`} className={`${card} flex items-center gap-3 hover:bg-gray-50`}>
                    <span className="grid h-14 w-12 shrink-0 place-items-center rounded-2xl bg-brand-light text-brand">
                      <span className="text-center leading-tight">
                        <b className="block text-lg">{d.day}</b>
                        <span className="block text-[11px]">{t(`${d.month + 1}月`, MONTH_EN[d.month])}</span>
                      </span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <b className="truncate text-gray-900">{m.title}</b>
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-gray-500">
                        {timeText(m.startsAt, m.endsAt)}
                        {m.location ? ` · ${m.location}` : ""} · {t(`${m.people} 人`, `${m.people} people`)}
                      </span>
                      <span className="mt-1 flex flex-wrap gap-1.5">
                        <Pill>{t(`备注 ${m.notes}`, `${m.notes} notes`)}</Pill>
                        {m.raised > 0 && <Pill tone={m.open ? "amber" : "teal"}>{m.open ? t(`问题 ${m.raised} · 未完成 ${m.open}`, `${m.open} of ${m.raised} open`) : t(`问题 ${m.raised} · 都完成了`, `${m.raised} issues, all done`)}</Pill>}
                        {m.myNoteMissing && <Pill tone="rose">{t("你还没写备注", "Your notes missing")}</Pill>}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      {m.status === "DONE" ? <Pill tone="teal">{t("已完成", "Done")}</Pill> : <Pill tone="violet">{t("进行中", "Open")}</Pill>}
                      <IconChevronRight size={16} className="text-gray-300" />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )
      )}

      {data && tab !== "meetings" && (
        <section className={card}>
          {(tab === "mine" ? data.mine : data.open).length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">
              {tab === "mine" ? t("没有交给你处理或跟进的事项。", "Nothing assigned to you.") : t("全部问题都完成了。", "Every issue is done.")}
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {(tab === "mine" ? data.mine : data.open).map((i) => (
                <IssueCard key={i.issueCode} issue={i} people={people} showMeeting onChanged={load} />
              ))}
            </ul>
          )}
        </section>
      )}

      {isManager && creating && (
        <MeetingFormSheet open onClose={() => setCreating(false)} people={people} me={me} onSaved={(code) => router.push(`/meetings/${code}`)} />
      )}
    </div>
  );
}
