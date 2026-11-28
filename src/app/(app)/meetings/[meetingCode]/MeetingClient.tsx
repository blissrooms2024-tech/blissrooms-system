"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ConfirmDialog from "@/components/ConfirmDialog";
import Pill from "@/components/Pill";
import { useLanguage } from "@/components/LanguageProvider";
import { useToast } from "@/components/Toast";
import { IconCalendar, IconChat, IconCheck, IconChevronLeft, IconCopy, IconMapPin, IconPen, IconPlus, IconRefresh, IconTrash, IconUsers } from "@/components/icons";
import { minutesText, timeText, whenText } from "@/lib/meetingText";
import type { MeetingDetail, Person } from "@/lib/meetings";
import { IssueCard, IssueSheet, MeetingFormSheet, ROLE_LABEL, card } from "../ui";

const REFRESH_MS = 20_000;

/** One meeting: when, where, who; everyone's own notes side by side; the issues it raised,
 * closed, and the ones still open from earlier meetings. */
export default function MeetingClient({ code }: { code: string }) {
  const { t } = useLanguage();
  const toast = useToast();
  const router = useRouter();
  const [m, setM] = useState<MeetingDetail | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addingIssue, setAddingIssue] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState<"finish" | "delete" | null>(null);
  // Read inside load() (a stable callback) to know whether I'm in the middle of typing.
  const dirtyRef = useRef(false);
  const markDirty = (v: boolean) => {
    dirtyRef.current = v;
    setDirty(v);
  };

  const load = useCallback(async () => {
    try {
      const d = await fetch(`/api/meetings/${encodeURIComponent(code)}`).then((r) => r.json());
      if (!d.success) return setError(d.message);
      setError("");
      const next = d.meeting as MeetingDetail;
      setM(next);
      // Keep what I'm typing; otherwise show my saved notes.
      if (!dirtyRef.current) setDraft(next.notes.find((n) => n.mine)?.body ?? "");
    } catch {
      setError(t("网络连接失败，请检查网络后重试", "Network connection failed — please try again"));
    }
  }, [code, t]);

  useEffect(() => {
    // Every setState in load() happens after the fetch's await, not synchronously in the effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    fetch("/api/meetings/people")
      .then((r) => r.json())
      .then((p) => p.success && setPeople(p.people))
      .catch(() => {});
    // Others write their notes at the same time — pick them up while the page is open.
    const timer = setInterval(() => document.visibilityState === "visible" && load(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  async function saveNote() {
    setSaving(true);
    try {
      const d = await fetch(`/api/meetings/${code}/note`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: draft }) }).then((r) => r.json());
      if (!d.success) return toast.danger(d.message);
      toast.success(d.message);
      markDirty(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(status: "OPEN" | "DONE") {
    const d = await fetch(`/api/meetings/${code}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }).then((r) => r.json());
    setConfirm(null);
    if (!d.success) return toast.danger(d.message);
    toast.success(d.message);
    load();
  }

  async function remove() {
    const d = await fetch(`/api/meetings/${code}`, { method: "DELETE" }).then((r) => r.json());
    setConfirm(null);
    if (!d.success) return toast.danger(d.message);
    toast.success(d.message);
    router.push("/meetings");
  }

  const text = m ? minutesText(m) : "";
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t("已复制会议记录，可以贴到 WhatsApp", "Copied — paste it into WhatsApp"));
    } catch {
      toast.warning(t("复制失败，请手动复制", "Couldn't copy — please copy it manually"));
    }
  }

  if (error && !m) {
    return (
      <div className="app-type mx-auto max-w-3xl space-y-3">
        <Link href="/meetings" className="inline-flex items-center gap-0.5 text-sm text-gray-500 hover:text-brand">
          <IconChevronLeft size={16} />
          {t("会议记录", "Meetings")}
        </Link>
        <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      </div>
    );
  }
  if (!m) return <div className="app-type mx-auto h-48 max-w-3xl animate-pulse rounded-[20px] bg-white/80 motion-reduce:animate-none" />;

  const open = m.status === "OPEN";
  const others = m.attendees.filter((a) => a.id !== m.me.id);
  const noteOf = (id: string) => m.notes.find((n) => n.authorId === id);
  // Notes from someone no longer on the list still belong to the record.
  const strays = m.notes.filter((n) => !n.mine && !m.attendees.some((a) => a.id === n.authorId));
  const myNote = m.notes.find((n) => n.mine);
  const doneHere = [...m.raised.filter((i) => i.status === "DONE"), ...m.closedHere];
  const openRaised = m.raised.filter((i) => i.status === "OPEN");
  const peopleCount = m.attendees.length + m.guests.length;

  return (
    <div className="app-type mx-auto max-w-3xl space-y-4">
      <Link href="/meetings" className="inline-flex items-center gap-0.5 text-sm text-gray-500 hover:text-brand">
        <IconChevronLeft size={16} />
        {t("会议记录", "Meetings")}
      </Link>

      {/* when, where, who */}
      <section className={card}>
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-xl font-semibold leading-snug text-gray-900">{m.title}</h1>
          <span className="flex shrink-0 items-center gap-1">
            {open ? <Pill tone="violet">{t("进行中", "Open")}</Pill> : <Pill tone="teal">{t("已完成", "Done")}</Pill>}
            {m.can.edit && (
              <button type="button" onClick={() => setEditing(true)} aria-label={t("改会议资料", "Edit meeting")} className="grid h-9 w-9 place-items-center rounded-xl text-gray-500 hover:bg-gray-100">
                <IconPen size={17} />
              </button>
            )}
          </span>
        </div>
        <ul className="mt-2 space-y-1.5 text-sm text-gray-700">
          <li className="flex items-center gap-2">
            <IconCalendar size={16} className="shrink-0 text-gray-400" />
            {whenText(m.startsAt, null).slice(0, 13)} {timeText(m.startsAt, m.endsAt)}
          </li>
          {m.location && (
            <li className="flex items-center gap-2">
              <IconMapPin size={16} className="shrink-0 text-gray-400" />
              {m.location}
            </li>
          )}
          <li className="flex items-start gap-2">
            <IconUsers size={16} className="mt-0.5 shrink-0 text-gray-400" />
            <span>
              <b className="font-medium">{t(`参加 ${peopleCount} 人`, `${peopleCount} people`)}</b>
              <span className="mt-1 flex flex-wrap gap-1.5">
                {m.attendees.map((a) => (
                  <span key={a.id} className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-700">
                    {a.name}
                    <span className="ml-1 text-gray-400">{t(ROLE_LABEL[a.role]?.zh ?? a.role, ROLE_LABEL[a.role]?.en ?? a.role)}</span>
                  </span>
                ))}
                {m.guests.map((g) => (
                  <span key={g} className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs text-amber-900">
                    {g}
                  </span>
                ))}
              </span>
            </span>
          </li>
        </ul>
        {!open && m.finishedAt && (
          <p className="mt-2 text-xs text-gray-400">{t(`${m.finishedBy ?? ""} 在 ${whenText(m.finishedAt, null)} 完成了这份记录`, `Finished by ${m.finishedBy ?? ""} on ${whenText(m.finishedAt, null)}`)}</p>
        )}
      </section>

      {/* still open from earlier meetings */}
      {m.carried.length > 0 && (
        <section className={card}>
          <h2 className="text-[15px] font-semibold text-gray-900">{t(`之前还没完成的问题 · ${m.carried.length}`, `Still open from before · ${m.carried.length}`)}</h2>
          <p className="text-xs text-gray-500">{t("开会时一起过一遍；在这里按完成，会记在这次会议。", "Go through them; marking one done here records it at this meeting.")}</p>
          <ul className="divide-y divide-gray-100">
            {m.carried.map((i) => (
              <IssueCard key={i.issueCode} issue={i} people={people} meetingCode={m.code} showMeeting onChanged={load} />
            ))}
          </ul>
        </section>
      )}

      {/* everyone's notes */}
      <section className={card}>
        <h2 className="text-[15px] font-semibold text-gray-900">{t("会议内容", "Notes")}</h2>
        <p className="mb-3 text-xs text-gray-500">{t("每个人用自己的账号写自己的备注，合起来就是这次的会议记录。", "Everyone writes their own notes from their own account; together they're the record.")}</p>

        {m.can.write ? (
          <div className="rounded-2xl border border-brand/30 bg-brand-light/30 p-3">
            <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
              <b className="font-semibold text-gray-900">{t(`${m.me.name}（我）`, `${m.me.name} (me)`)}</b>
              <span className="text-xs text-gray-500">
                {dirty ? t("还没保存", "Not saved") : myNote ? t(`已保存 ${timeText(myNote.updatedAt, null)}`, `Saved ${timeText(myNote.updatedAt, null)}`) : ""}
              </span>
            </div>
            <textarea
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                markDirty(true);
              }}
              rows={6}
              maxLength={20000}
              className="input min-h-[140px] bg-white leading-relaxed"
              placeholder={t("写下你记的内容：讨论了什么、决定了什么……", "What was discussed, what was decided…")}
            />
            <button type="button" onClick={saveNote} disabled={saving || !dirty} className="btn-primary mt-2 flex w-full items-center justify-center gap-1.5 py-2.5">
              <IconCheck size={18} />
              {saving ? t("保存中…", "Saving…") : t("保存我的备注", "Save my notes")}
            </button>
          </div>
        ) : (
          myNote && <NoteCard name={t(`${m.me.name}（我）`, `${m.me.name} (me)`)} body={myNote.body} at={myNote.updatedAt} />
        )}

        <div className="mt-3 space-y-3">
          {others.map((a) => {
            const n = noteOf(a.id);
            return n ? (
              <NoteCard key={a.id} name={a.name} role={a.role} body={n.body} at={n.updatedAt} />
            ) : (
              <div key={a.id} className="flex items-center justify-between rounded-2xl border border-dashed border-gray-200 px-3 py-2.5 text-sm">
                <span className="text-gray-700">
                  {a.name} <span className="text-xs text-gray-400">{t(ROLE_LABEL[a.role]?.zh ?? a.role, ROLE_LABEL[a.role]?.en ?? a.role)}</span>
                </span>
                <span className="text-xs text-gray-400">{open ? t("还没写备注", "No notes yet") : t("没有写备注", "No notes")}</span>
              </div>
            );
          })}
          {strays.map((n) => (
            <NoteCard key={n.authorId} name={n.author} body={n.body} at={n.updatedAt} />
          ))}
        </div>
        {open && <p className="mt-3 text-xs text-gray-400">{t("别人的备注每 20 秒自动更新。", "Others' notes refresh every 20 seconds.")}</p>}
      </section>

      {/* issues raised */}
      <section className={card}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[15px] font-semibold text-gray-900">{t(`要解决的问题 · ${openRaised.length}`, `To sort out · ${openRaised.length}`)}</h2>
          {m.can.addIssue && (
            <button type="button" onClick={() => setAddingIssue(true)} className="flex items-center gap-1 rounded-xl bg-brand-light px-3 py-2 text-sm font-semibold text-brand hover:brightness-95">
              <IconPlus size={16} />
              {t("加问题", "Add")}
            </button>
          )}
        </div>
        {openRaised.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-400">{t("这次会议还没有要解决的问题。", "No open issues from this meeting.")}</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {openRaised.map((i) => (
              <IssueCard key={i.issueCode} issue={i} people={people} meetingCode={m.code} onChanged={load} />
            ))}
          </ul>
        )}
      </section>

      {doneHere.length > 0 && (
        <section className={card}>
          <h2 className="text-[15px] font-semibold text-gray-900">{t(`完成的问题 · ${doneHere.length}`, `Done · ${doneHere.length}`)}</h2>
          <ul className="divide-y divide-gray-100">
            {doneHere.map((i) => (
              <IssueCard key={i.issueCode} issue={i} people={people} showMeeting={i.meeting.code !== m.code} onChanged={load} />
            ))}
          </ul>
        </section>
      )}

      {/* share, finish */}
      <section className={card}>
        <h2 className="mb-2 text-[15px] font-semibold text-gray-900">{t("整份会议记录", "The whole record")}</h2>
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-[#e7f8ee] p-3 font-sans text-[13px] leading-relaxed text-gray-800">{text}</pre>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" onClick={copy} className="btn-soft flex items-center justify-center gap-1.5 py-2.5">
            <IconCopy size={17} />
            {t("复制", "Copy")}
          </button>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(text)}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-1.5 rounded-lg bg-[#25D366] py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            <IconChat size={18} />
            WhatsApp
          </a>
        </div>
        {m.can.finish && (
          <button type="button" onClick={() => setConfirm("finish")} className="btn-primary mt-2 flex w-full items-center justify-center gap-1.5 py-2.5">
            <IconCheck size={18} />
            {t("完成会议记录", "Finish the record")}
          </button>
        )}
        {m.can.reopen && (
          <button type="button" onClick={() => setStatus("OPEN")} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-gray-50 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100">
            <IconRefresh size={17} />
            {t("重新打开，让大家再改备注", "Reopen for more notes")}
          </button>
        )}
      </section>

      {m.can.delete && (
        <button type="button" onClick={() => setConfirm("delete")} className="flex w-full items-center justify-center gap-1.5 rounded-2xl py-3 text-sm font-medium text-rose-600 hover:bg-rose-50">
          <IconTrash size={16} />
          {t("删除这份会议记录", "Delete this meeting")}
        </button>
      )}

      {addingIssue && <IssueSheet open onClose={() => setAddingIssue(false)} people={people} meetingCode={m.code} onSaved={load} />}
      {editing && <MeetingFormSheet open onClose={() => setEditing(false)} people={people} me={m.me.id} meeting={m} onSaved={() => load()} />}
      <ConfirmDialog
        open={confirm === "finish"}
        title={t("完成会议记录", "Finish the record")}
        message={t(
          `完成后，大家的备注就不能再改；问题照样可以跟进和标记完成。${others.some((a) => !noteOf(a.id)) ? `还有人没写备注：${others.filter((a) => !noteOf(a.id)).map((a) => a.name).join("、")}。` : ""}`,
          `Notes can't be changed after this; issues can still be followed up.${others.some((a) => !noteOf(a.id)) ? ` Still no notes from: ${others.filter((a) => !noteOf(a.id)).map((a) => a.name).join(", ")}.` : ""}`
        )}
        confirmLabel={t("完成", "Finish")}
        onConfirm={() => setStatus("DONE")}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === "delete"}
        danger
        title={t("删除这份会议记录", "Delete this meeting")}
        message={t("大家的备注和这次会议的问题都会一起删除。", "Everyone's notes and this meeting's issues are deleted too.")}
        confirmLabel={t("删除", "Delete")}
        onConfirm={remove}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}

function NoteCard({ name, role, body, at }: { name: string; role?: string; body: string; at: string }) {
  const { t } = useLanguage();
  return (
    <div className="rounded-2xl bg-gray-50 p-3">
      <div className="mb-1 flex items-center justify-between gap-2 text-sm">
        <span>
          <b className="font-semibold text-gray-900">{name}</b>
          {role && <span className="ml-1 text-xs text-gray-400">{t(ROLE_LABEL[role]?.zh ?? role, ROLE_LABEL[role]?.en ?? role)}</span>}
        </span>
        <span className="text-xs text-gray-400">{whenText(at, null).slice(0, 5)} {timeText(at, null)}</span>
      </div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">{body}</p>
    </div>
  );
}
