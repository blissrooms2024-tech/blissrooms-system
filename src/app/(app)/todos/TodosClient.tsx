"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Sheet from "@/components/Sheet";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useLanguage } from "@/components/LanguageProvider";
import { useToast } from "@/components/Toast";
import { IconCheck, IconChevronRight, IconListCheck, IconNotes, IconPlus, IconTrash } from "@/components/icons";
import type { MeetingItem, TodoView } from "@/lib/todos";
import { addDays, bucketOf, dueLabel, nextMonday, shortDate, todayMY } from "@/lib/todoText";

type Person = { id: string; name: string; role: string };
type Tab = "mine" | "team";

const ROLE: Record<string, { zh: string; en: string }> = {
  BOSS: { zh: "Boss", en: "Boss" },
  ADMIN: { zh: "Admin", en: "Admin" },
  AGENT: { zh: "Agent", en: "Agent" },
  WORKER: { zh: "师傅", en: "Worker" },
};
const TONE = { rose: "font-medium text-rose-600", amber: "font-medium text-amber-700", gray: "text-gray-500" } as const;
const CARD = "rounded-2xl bg-white shadow-[0_1px_2px_rgba(30,27,46,0.05)]";

export default function TodosClient({
  me,
  manager,
  initialTab,
  startNew,
}: {
  me: string;
  manager: boolean;
  initialTab: Tab;
  startNew: boolean;
}) {
  const { t } = useLanguage();
  const toast = useToast();
  const [today] = useState(todayMY);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [mine, setMine] = useState<{ todos: TodoView[]; issues: MeetingItem[] } | null>(null);
  const [team, setTeam] = useState<TodoView[] | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [error, setError] = useState("");
  /** The add / edit sheet: a to-do to change, or a new one (for someone, on the team tab). */
  const [sheet, setSheet] = useState<{ todo?: TodoView; owner?: string } | null>(startNew ? {} : null);
  const [showDone, setShowDone] = useState(false);
  const [lateOnly, setLateOnly] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [a, b] = await Promise.all([
        fetch("/api/todos").then((r) => r.json()),
        manager ? fetch("/api/todos?scope=team").then((r) => r.json()) : Promise.resolve(null),
      ]);
      if (!a.success) {
        setError(a.message);
        return;
      }
      setMine({ todos: a.todos, issues: a.issues });
      if (b?.success) {
        setTeam(b.todos);
        setPeople(b.people);
      }
      setError("");
    } catch {
      setError(t("载入失败，请稍后再试", "Couldn't load — try again later"));
    }
  }, [manager, t]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- first load; state is set after the fetch resolves
    void load();
  }, [load]);

  async function toggle(todo: TodoView) {
    const next = todo.status === "DONE" ? "OPEN" : "DONE";
    setBusy(todo.code);
    // Tick it straight away; the reload below puts it right if the server says no.
    const flip = (list: TodoView[]) => list.map((x) => (x.code === todo.code ? { ...x, status: next as TodoView["status"], doneAt: next === "DONE" ? new Date().toISOString() : null } : x));
    setMine((m) => m && { ...m, todos: flip(m.todos) });
    setTeam((l) => l && flip(l));
    try {
      const res = await fetch(`/api/todos/${todo.code}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: next }) });
      const data = await res.json();
      if (data.success) toast.success(next === "DONE" ? t(`完成：${todo.title}`, `Done: ${todo.title}`) : t(`重新打开：${todo.title}`, `Reopened: ${todo.title}`));
      else toast.danger(data.message);
    } catch {
      toast.danger(t("系统出错，请稍后再试", "System error — please try again later"));
    }
    setBusy(null);
    void load();
  }

  async function finishIssue(i: MeetingItem) {
    setBusy(i.code);
    try {
      const res = await fetch(`/api/meetings/issues/${i.code}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "DONE" }) });
      const data = await res.json();
      if (data.success) toast.success(t(`完成：${i.title}`, `Done: ${i.title}`));
      else toast.danger(data.message);
    } catch {
      toast.danger(t("系统出错，请稍后再试", "System error — please try again later"));
    }
    setBusy(null);
    void load();
  }

  const open = mine?.todos.filter((x) => x.status === "OPEN") ?? [];
  const done = (mine?.todos.filter((x) => x.status === "DONE") ?? []).sort((a, b) => (b.doneAt ?? "").localeCompare(a.doneAt ?? ""));
  const groups = [
    { key: "OVERDUE", l: t("过了期限", "Late"), tone: "text-rose-600" },
    { key: "TODAY", l: t("今天", "Today"), tone: "text-amber-700" },
    { key: "LATER", l: t("之后", "Coming up"), tone: "text-gray-600" },
    { key: "NODATE", l: t("没有期限", "No date"), tone: "text-gray-600" },
  ].map((g) => ({ ...g, items: open.filter((x) => bucketOf(x, today) === g.key) }));
  const issues = mine?.issues ?? [];

  const teamOpen = (team ?? []).filter((x) => x.status === "OPEN");
  const byPerson = people
    .map((p) => {
      const items = teamOpen.filter((x) => x.ownerId === p.id);
      const late = items.filter((x) => bucketOf(x, today) === "OVERDUE");
      return { ...p, items, late: late.length, lateItems: late, doneCount: (team ?? []).filter((x) => x.ownerId === p.id && x.status === "DONE").length };
    })
    .sort((a, b) => b.late - a.late || b.items.length - a.items.length || a.name.localeCompare(b.name));
  const teamLate = byPerson.reduce((n, p) => n + p.late, 0);
  const shownPeople = lateOnly ? byPerson.filter((p) => p.late > 0) : byPerson;

  const rowProps = { today, busy, onToggle: toggle, onOpen: (todo: TodoView) => setSheet({ todo }) };

  return (
    <div className="app-type mx-auto max-w-3xl space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-semibold text-gray-900">
          {t("待办", "To-dos")}
          {mine && <span className="ml-1.5 text-sm font-normal text-gray-400">{open.length + issues.length}</span>}
        </h1>
        <button type="button" onClick={() => setSheet({})} className="flex h-9 items-center gap-1 rounded-xl bg-brand px-3 text-[13px] font-semibold text-white hover:bg-brand-dark">
          <IconPlus size={16} />
          {t("新待办", "New")}
        </button>
      </div>

      {manager && (
        <nav aria-label={t("待办", "To-dos")} className="grid max-w-sm grid-cols-2 rounded-xl bg-gray-200/60 p-1 text-[14px] font-semibold">
          {(["mine", "team"] as const).map((k) => {
            const on = tab === k;
            return (
              <button
                key={k}
                type="button"
                aria-pressed={on}
                onClick={() => setTab(k)}
                className={`flex h-8 items-center justify-center gap-1 rounded-lg ${on ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-800"}`}
              >
                {k === "mine" ? t("我的", "Mine") : t("团队", "Team")}
                {k === "mine" && mine && <span className="text-[12px] font-normal text-gray-400">{open.length + issues.length}</span>}
                {k === "team" && team && (
                  <span className={`text-[12px] font-normal ${teamLate ? "text-rose-600" : "text-gray-400"}`}>{teamLate ? t(`${teamLate} 过期`, `${teamLate} late`) : teamOpen.length}</span>
                )}
              </button>
            );
          })}
        </nav>
      )}

      {error && (
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <span>{error}</span>
          <button type="button" onClick={() => void load()} className="shrink-0 font-semibold underline">
            {t("再试一次", "Try again")}
          </button>
        </div>
      )}
      {!mine && !error && (
        <ul className="space-y-2" aria-label={t("载入中", "Loading")}>
          {[0, 1, 2].map((i) => (
            <li key={i} className="h-12 animate-pulse rounded-2xl bg-white/80 motion-reduce:animate-none" />
          ))}
        </ul>
      )}

      {mine && tab === "mine" && (
        <>
          {open.length + issues.length === 0 ? (
            <div className="rounded-[20px] bg-white px-6 py-10 text-center shadow-sm">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-brand-light text-brand">
                <IconListCheck size={24} />
              </span>
              <p className="mt-3 font-medium text-gray-900">{t("没有要做的事", "Nothing to do")}</p>
              <p className="mx-auto mt-1 max-w-xs text-sm text-gray-500">
                {t("按「新待办」加一项。到期那天早上 8 点还没打勾，系统会寄 email 提醒你。", "Tap New to add one. If it isn't ticked by 8am on the day it's due, you'll get an email.")}
              </p>
            </div>
          ) : (
            <p className="px-1 text-xs text-gray-500">{t("到期那天早上 8 点还没打勾的，会寄 email 提醒。", "Anything not ticked by 8am on its day is emailed to you.")}</p>
          )}

          {groups
            .filter((g) => g.items.length)
            .map((g) => (
              <section key={g.key}>
                <h2 className={`mb-1.5 px-1 text-[13px] font-semibold ${g.tone}`}>
                  {g.l} <span className="font-normal text-gray-400">{g.items.length}</span>
                </h2>
                <ul className="space-y-1.5">
                  {g.items.map((x) => (
                    <TodoRow key={x.code} todo={x} {...rowProps} />
                  ))}
                </ul>
              </section>
            ))}

          {issues.length > 0 && (
            <section>
              <h2 className="mb-1.5 px-1 text-[13px] font-semibold text-brand">
                {t("会议里分给我的", "From meetings")} <span className="font-normal text-gray-400">{issues.length}</span>
              </h2>
              <ul className="space-y-1.5">
                {issues.map((i) => (
                  <IssueRow key={i.code} item={i} today={today} busy={busy === i.code} onDone={() => finishIssue(i)} />
                ))}
              </ul>
            </section>
          )}

          {done.length > 0 && (
            <section>
              <button type="button" onClick={() => setShowDone((v) => !v)} aria-expanded={showDone} className="flex items-center gap-1 px-1 text-[13px] font-semibold text-gray-500">
                <IconChevronRight size={15} className={`transition-transform motion-reduce:transition-none ${showDone ? "rotate-90" : ""}`} />
                {t(`已完成（两星期内）`, "Done (last two weeks)")} <span className="font-normal text-gray-400">{done.length}</span>
              </button>
              {showDone && (
                <ul className="mt-1.5 space-y-1.5">
                  {done.map((x) => (
                    <TodoRow key={x.code} todo={x} {...rowProps} />
                  ))}
                </ul>
              )}
            </section>
          )}
        </>
      )}

      {manager && tab === "team" && team && (
        <>
          <div className="flex gap-2">
            {[
              { on: !lateOnly, l: t("全部人", "Everyone"), n: byPerson.length, set: false },
              { on: lateOnly, l: t("只看过期", "Late only"), n: teamLate, set: true },
            ].map((c) => (
              <button
                key={String(c.set)}
                type="button"
                aria-pressed={c.on}
                onClick={() => setLateOnly(c.set)}
                className={`flex h-8 items-center gap-1 rounded-full px-3 text-[13px] font-medium ${c.on ? "bg-brand text-white" : "bg-white text-gray-700 shadow-sm hover:bg-gray-50"}`}
              >
                {c.l}
                <span className={`text-[11px] ${c.on ? "text-white/80" : c.set && c.n ? "font-semibold text-rose-600" : "text-gray-400"}`}>{c.n}</span>
              </button>
            ))}
          </div>

          {shownPeople.length === 0 && (
            <p className="rounded-[20px] bg-white px-4 py-8 text-center text-sm text-gray-400">{t("没有人的待办过了期限", "Nobody is behind")}</p>
          )}
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            {shownPeople.map((p) => {
              const items = lateOnly ? p.lateItems : p.items;
              const role = ROLE[p.role];
              return (
                <section key={p.id} className={`${CARD} min-w-0 p-2.5`}>
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-light text-[13px] font-semibold text-brand">
                      {p.name.trim().charAt(0).toUpperCase() || "?"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold text-gray-900">
                        {p.name}
                        {p.id === me && <span className="font-normal text-gray-400">{t("（我）", " (me)")}</span>}
                        <span className="ml-1.5 text-[11.5px] font-normal text-gray-400">{role ? t(role.zh, role.en) : p.role}</span>
                      </p>
                      <p className="truncate text-[11.5px] text-gray-500">
                        {p.items.length ? t(`${p.items.length} 项`, `${p.items.length} open`) : t("没有待办", "Nothing open")}
                        {p.late > 0 && <span className="font-medium text-rose-600">{t(` · ${p.late} 项过期`, ` · ${p.late} late`)}</span>}
                        {p.doneCount > 0 && t(` · 两星期内完成 ${p.doneCount}`, ` · ${p.doneCount} done lately`)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSheet({ owner: p.id })}
                      aria-label={t(`派待办给 ${p.name}`, `Give ${p.name} a to-do`)}
                      className="flex h-8 shrink-0 items-center gap-1 rounded-lg bg-brand-light px-2.5 text-[12px] font-semibold text-brand hover:bg-violet-100"
                    >
                      <IconPlus size={14} />
                      {t("派待办", "Assign")}
                    </button>
                  </div>
                  {items.length > 0 && (
                    <ul className="mt-2 divide-y divide-gray-100 border-t border-gray-100">
                      {items.map((x) => (
                        <TodoRow key={x.code} todo={x} {...rowProps} flat />
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        </>
      )}

      {sheet && (
        <TodoSheet
          key={sheet.todo?.code ?? `new-${sheet.owner ?? me}`}
          todo={sheet.todo}
          presetOwner={sheet.owner}
          people={people}
          me={me}
          manager={manager}
          today={today}
          onClose={() => setSheet(null)}
          onSaved={() => {
            setSheet(null);
            void load();
          }}
          onToggle={(x) => {
            setSheet(null);
            void toggle(x);
          }}
        />
      )}
    </div>
  );
}

/** One to-do: a round tick box, what it is, and when it's due. Tapping the text opens it. */
function TodoRow({
  todo,
  today,
  busy,
  onToggle,
  onOpen,
  flat = false,
}: {
  todo: TodoView;
  today: string;
  busy: string | null;
  onToggle: (t: TodoView) => void;
  onOpen: (t: TodoView) => void;
  flat?: boolean;
}) {
  const { t, locale } = useLanguage();
  const doneNow = todo.status === "DONE";
  const due = doneNow ? null : dueLabel(todo.dueDate, today, locale === "en");
  const late = due?.tone === "rose";
  return (
    <li className={`flex items-start gap-1 ${flat ? "py-0.5" : `${CARD} py-0.5 pl-1 pr-3`}`}>
      <button
        type="button"
        disabled={!todo.canToggle || busy === todo.code}
        onClick={() => onToggle(todo)}
        aria-label={doneNow ? t(`重新打开：${todo.title}`, `Reopen: ${todo.title}`) : t(`完成：${todo.title}`, `Mark done: ${todo.title}`)}
        className="grid h-10 w-10 shrink-0 place-items-center rounded-full disabled:opacity-50"
      >
        <span
          className={`grid h-[22px] w-[22px] place-items-center rounded-full border-2 ${
            doneNow ? "border-teal-600 bg-teal-600 text-white" : late ? "border-rose-400 hover:bg-rose-50" : "border-gray-300 hover:border-brand"
          }`}
        >
          {doneNow && <IconCheck size={14} />}
        </span>
      </button>
      <button type="button" onClick={() => onOpen(todo)} className="min-w-0 flex-1 py-2 text-left">
        <p className={`text-[14px] leading-snug ${doneNow ? "text-gray-400 line-through" : "text-gray-900"}`}>{todo.title}</p>
        {(due || todo.givenBy || todo.note || doneNow) && (
          <p className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 text-[11.5px] text-gray-400">
            {due && <span className={TONE[due.tone]}>{due.text}</span>}
            {todo.givenBy && <span>{t(`${todo.givenBy} 给的`, `from ${todo.givenBy}`)}</span>}
            {doneNow && todo.doneAt && <span>{t(`${shortDate(todayMY(Date.parse(todo.doneAt)), today)} 完成`, `done ${shortDate(todayMY(Date.parse(todo.doneAt)), today)}`)}</span>}
            {todo.note && (
              <span className="flex min-w-0 max-w-full items-center gap-0.5">
                <IconNotes size={12} className="shrink-0" />
                <span className="truncate">{todo.note}</span>
              </span>
            )}
          </p>
        )}
      </button>
    </li>
  );
}

/** A meeting item this person handles or follows up, listed with their to-dos. */
function IssueRow({ item, today, busy, onDone }: { item: MeetingItem; today: string; busy: boolean; onDone: () => void }) {
  const { t, locale } = useLanguage();
  const due = dueLabel(item.dueDate, today, locale === "en");
  return (
    <li className={`flex items-start gap-1 ${CARD} py-0.5 pl-1 pr-2`}>
      <button
        type="button"
        disabled={busy}
        onClick={onDone}
        aria-label={t(`完成：${item.title}`, `Mark done: ${item.title}`)}
        className="grid h-10 w-10 shrink-0 place-items-center rounded-full disabled:opacity-50"
      >
        <span className={`h-[22px] w-[22px] rounded-full border-2 ${due?.tone === "rose" ? "border-rose-400 hover:bg-rose-50" : "border-gray-300 hover:border-brand"}`} />
      </button>
      <Link href={`/meetings/${item.meetingCode}`} className="flex min-w-0 flex-1 items-center gap-1 py-2">
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] leading-snug text-gray-900">{item.title}</span>
          <span className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 text-[11.5px] text-gray-400">
            {due && <span className={TONE[due.tone]}>{due.text}</span>}
            <span>{item.as === "OWNER" ? t("我处理", "I handle it") : t("我跟进", "I follow up")}</span>
            <span className="truncate">{t(`会议「${item.meetingTitle}」`, `meeting “${item.meetingTitle}”`)}</span>
          </span>
        </span>
        <IconChevronRight size={16} className="shrink-0 text-gray-300" />
      </Link>
    </li>
  );
}

/** Add a to-do (yours, or — Boss / Admin — someone else's), or open one to change, tick or delete. */
function TodoSheet({
  todo,
  presetOwner,
  people,
  me,
  manager,
  today,
  onClose,
  onSaved,
  onToggle,
}: {
  todo?: TodoView;
  presetOwner?: string;
  people: Person[];
  me: string;
  manager: boolean;
  today: string;
  onClose: () => void;
  onSaved: () => void;
  onToggle: (t: TodoView) => void;
}) {
  const { t, locale } = useLanguage();
  const toast = useToast();
  const [title, setTitle] = useState(todo?.title ?? "");
  const [note, setNote] = useState(todo?.note ?? "");
  // A new to-do is for today unless changed: no date means no reminder.
  const [due, setDue] = useState(todo ? (todo.dueDate ?? "") : today);
  const [owner, setOwner] = useState(todo?.ownerId ?? presetOwner ?? me);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const readOnly = !!todo && !todo.canEdit;
  const ownerName = people.find((p) => p.id === owner)?.name;
  const quick = [
    { k: "today", l: t("今天", "Today"), v: today },
    { k: "tomorrow", l: t("明天", "Tomorrow"), v: addDays(today, 1) },
    { k: "monday", l: t("下星期一", "Next Mon"), v: nextMonday(today) },
    { k: "none", l: t("不定", "No date"), v: "" },
  ];

  async function save() {
    setSaving(true);
    try {
      const body: Record<string, unknown> = { title: title.trim(), note: note.trim() || null, dueDate: due || null };
      if (manager && (!todo || owner !== todo.ownerId)) body.ownerId = owner;
      const res = await fetch(todo ? `/api/todos/${todo.code}` : "/api/todos", {
        method: todo ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        onSaved();
      } else toast.danger(data.message);
    } catch {
      toast.danger(t("系统出错，请稍后再试", "System error — please try again later"));
    }
    setSaving(false);
  }

  async function remove() {
    if (!todo) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/todos/${todo.code}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        onSaved();
      } else toast.danger(data.message);
    } catch {
      toast.danger(t("系统出错，请稍后再试", "System error — please try again later"));
    }
    setSaving(false);
    setConfirmDelete(false);
  }

  const due0 = todo?.dueDate ? dueLabel(todo.dueDate, today, locale === "en") : null;

  return (
    <>
    <Sheet open onClose={() => !saving && onClose()} title={!todo ? t("新待办", "New to-do") : readOnly ? t("待办", "To-do") : t("改待办", "Edit to-do")} tall={!readOnly}>
      {readOnly && todo ? (
        <div className="space-y-3">
          <p className="text-base text-gray-900">{todo.title}</p>
          {todo.note && <p className="whitespace-pre-wrap rounded-xl bg-gray-50 px-3 py-2 text-sm text-gray-600">{todo.note}</p>}
          <p className="text-sm text-gray-500">
            {due0 ? <span className={TONE[due0.tone]}>{due0.text}</span> : t("没有期限", "No date")}
            {todo.givenBy && t(` · ${todo.givenBy} 给的`, ` · from ${todo.givenBy}`)}
          </p>
          <p className="text-xs text-gray-400">{t("这项是别人给你的，只有给的人或 Boss / Admin 可以改内容和期限。", "Someone gave you this one; only they or Boss / Admin can change it.")}</p>
          {todo.canToggle && (
            <button type="button" onClick={() => onToggle(todo)} className="btn-primary flex w-full items-center justify-center gap-1.5 py-2.5">
              <IconCheck size={18} />
              {todo.status === "DONE" ? t("重新打开", "Reopen") : t("完成了", "Mark done")}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-sm text-gray-600">{t("要做什么", "What needs doing")}</span>
            <input
              autoFocus={!todo}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              className="input"
              placeholder={t("例如：跟进 PXC-03 冷气维修", "e.g. Follow up PXC-03 aircon repair")}
            />
          </label>

          <div>
            <span className="mb-1 block text-sm text-gray-600">{t("期限", "Due")}</span>
            <div className="flex flex-wrap gap-1.5">
              {quick.map((q) => {
                const on = due === q.v;
                return (
                  <button
                    key={q.k}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setDue(q.v)}
                    className={`h-8 rounded-full px-3 text-[13px] font-medium ${on ? "bg-brand text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                  >
                    {q.l}
                  </button>
                );
              })}
            </div>
            <input type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label={t("选日期", "Pick a date")} className="input mt-2" />
          </div>

          {manager && people.length > 0 && (
            <label className="block">
              <span className="mb-1 block text-sm text-gray-600">{t("给谁做", "Who does it")}</span>
              <select value={owner} onChange={(e) => setOwner(e.target.value)} className="input">
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.id === me ? t(`${p.name}（我）`, `${p.name} (me)`) : `${p.name} · ${ROLE[p.role] ? t(ROLE[p.role].zh, ROLE[p.role].en) : p.role}`}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="block">
            <span className="mb-1 block text-sm text-gray-600">{t("备注（可不填）", "Note (optional)")}</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={2000} className="input" />
          </label>

          <p className="text-xs text-gray-500">
            {owner !== me && ownerName && (!todo || owner !== todo.ownerId) && t(`${ownerName} 会马上收到 email。`, `${ownerName} gets an email now. `)}
            {due ? t("到期那天早上 8 点还没打勾，会寄 email 提醒。", "If it isn't ticked by 8am on the day, an email reminder goes out.") : t("没有期限就不会寄提醒。", "No date, no reminder.")}
          </p>

          <button type="button" onClick={save} disabled={saving || !title.trim()} className="btn-primary flex w-full items-center justify-center gap-1.5 py-2.5">
            {todo ? <IconCheck size={18} /> : <IconPlus size={18} />}
            {saving ? t("保存中…", "Saving…") : todo ? t("保存", "Save") : owner !== me && ownerName ? t(`派给 ${ownerName}`, `Give to ${ownerName}`) : t("加待办", "Add to-do")}
          </button>

          {todo && (
            <div className="grid grid-cols-2 gap-2">
              {todo.canToggle && (
                <button type="button" onClick={() => onToggle(todo)} disabled={saving} className="btn-soft flex items-center justify-center gap-1.5 py-2.5">
                  <IconCheck size={16} />
                  {todo.status === "DONE" ? t("重新打开", "Reopen") : t("完成了", "Mark done")}
                </button>
              )}
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                disabled={saving}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-rose-50 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-100"
              >
                <IconTrash size={16} />
                {t("删除", "Delete")}
              </button>
            </div>
          )}
        </div>
      )}
    </Sheet>
    {/* Outside the sheet so it sits above it, not inside its sliding panel. */}
    <ConfirmDialog
      open={confirmDelete}
      danger
      title={t("删除这项待办？", "Delete this to-do?")}
      message={todo?.title ?? ""}
      confirmLabel={t("删除", "Delete")}
      onConfirm={remove}
      onCancel={() => setConfirmDelete(false)}
    />
    </>
  );
}
