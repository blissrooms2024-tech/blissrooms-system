"use client";

import { useState } from "react";
import Link from "next/link";
import Sheet from "@/components/Sheet";
import ConfirmDialog from "@/components/ConfirmDialog";
import Pill from "@/components/Pill";
import { useLanguage } from "@/components/LanguageProvider";
import { useToast } from "@/components/Toast";
import { IconCheck, IconPen, IconPlus, IconRefresh, IconTrash, IconX } from "@/components/icons";
import { dueText, fromInputs, toInputs, whenText } from "@/lib/meetingText";
import type { IssueView, Person } from "@/lib/meetings";

/** Pieces shared by the 会议记录 list and meeting pages. */

export const card = "rounded-[20px] bg-white p-4 shadow-[0_1px_2px_rgba(30,27,46,0.04),0_12px_28px_-18px_rgba(76,29,149,0.22)]";
export const ROLE_LABEL: Record<string, { zh: string; en: string }> = {
  BOSS: { zh: "Boss", en: "Boss" },
  ADMIN: { zh: "Admin", en: "Admin" },
  AGENT: { zh: "Agent", en: "Agent" },
  WORKER: { zh: "师傅", en: "Worker" },
};

const todayMY = () => new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

/** Due date as a pill: overdue, today, or the date. */
export function DuePill({ issue }: { issue: Pick<IssueView, "dueDate" | "status"> }) {
  const { t } = useLanguage();
  if (!issue.dueDate || issue.status === "DONE") return null;
  const late = daysBetween(issue.dueDate, todayMY());
  if (late > 0) return <Pill tone="rose">{t(`逾期 ${late} 天`, `${late}d overdue`)}</Pill>;
  if (late === 0) return <Pill tone="amber">{t("今天到期", "Due today")}</Pill>;
  return <Pill>{t(`${dueText(issue.dueDate)} 前`, `by ${dueText(issue.dueDate)}`)}</Pill>;
}

/** One issue: what, who handles it, who follows up, when — and marking it done. */
export function IssueCard({
  issue,
  people,
  meetingCode,
  showMeeting = false,
  onChanged,
}: {
  issue: IssueView;
  people: Person[];
  /** Marking it done here records it as done at this meeting. */
  meetingCode?: string;
  showMeeting?: boolean;
  onChanged: () => void;
}) {
  const { t } = useLanguage();
  const toast = useToast();
  const [doneOpen, setDoneOpen] = useState(false);
  const [doneNote, setDoneNote] = useState("");
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [busy, setBusy] = useState(false);
  const done = issue.status === "DONE";

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const d = await fetch(`/api/meetings/issues/${issue.issueCode}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
      if (!d.success) return toast.danger(d.message);
      toast.success(d.message);
      setDoneOpen(false);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    const d = await fetch(`/api/meetings/issues/${issue.issueCode}`, { method: "DELETE" }).then((r) => r.json());
    setRemoving(false);
    if (!d.success) return toast.danger(d.message);
    toast.success(d.message);
    onChanged();
  }

  return (
    <li className="py-3">
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full ${done ? "bg-teal-600 text-white" : "border-2 border-gray-300"}`} aria-hidden>
          {done && <IconCheck size={14} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
            <p className={`text-[15px] font-medium ${done ? "text-gray-500 line-through decoration-gray-300" : "text-gray-900"}`}>{issue.title}</p>
            <DuePill issue={issue} />
          </div>
          {issue.detail && <p className="mt-0.5 whitespace-pre-wrap text-sm text-gray-600">{issue.detail}</p>}
          <p className="mt-1 text-xs text-gray-500">
            {t("处理", "Handles")}：<b className="font-medium text-gray-700">{issue.owner ?? t("还没定", "not set")}</b>
            {"　"}
            {t("跟进", "Follows up")}：<b className="font-medium text-gray-700">{issue.followUp ?? "—"}</b>
            {issue.mine && <span className="ml-1.5 rounded-full bg-brand-light px-1.5 py-px text-[10px] font-medium text-brand">{t("我的", "Mine")}</span>}
          </p>
          {showMeeting && (
            <Link href={`/meetings/${issue.meeting.code}`} className="mt-0.5 block text-xs text-gray-400 hover:text-brand">
              {t(`来自：${issue.meeting.title} · ${whenText(issue.meeting.startsAt, null).slice(0, 10)}`, `From: ${issue.meeting.title} · ${whenText(issue.meeting.startsAt, null).slice(0, 10)}`)}
            </Link>
          )}
          {done && (
            <p className="mt-1 text-xs text-teal-700">
              {t(`已完成 · ${issue.doneBy ?? ""} ${issue.doneAt ? whenText(issue.doneAt, null).slice(0, 5) : ""}`, `Done · ${issue.doneBy ?? ""} ${issue.doneAt ? whenText(issue.doneAt, null).slice(0, 5) : ""}`)}
              {issue.doneNote ? ` · ${issue.doneNote}` : ""}
            </p>
          )}
          {(issue.canUpdate || issue.canEdit) && (
            <div className="mt-2 flex flex-wrap gap-2">
              {issue.canUpdate &&
                (done ? (
                  <button type="button" disabled={busy} onClick={() => patch({ status: "OPEN" })} className="flex items-center gap-1 rounded-xl bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100">
                    <IconRefresh size={14} />
                    {t("重新打开", "Reopen")}
                  </button>
                ) : (
                  <button type="button" onClick={() => setDoneOpen(true)} className="flex items-center gap-1 rounded-xl bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-800 hover:bg-teal-100">
                    <IconCheck size={14} />
                    {t("完成", "Done")}
                  </button>
                ))}
              {issue.canEdit && !done && (
                <button type="button" onClick={() => setEditing(true)} className="flex items-center gap-1 rounded-xl bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100">
                  <IconPen size={14} />
                  {t("改", "Edit")}
                </button>
              )}
              {issue.canEdit && (
                <button type="button" onClick={() => setRemoving(true)} aria-label={t("删除这个问题", "Delete this issue")} className="grid h-8 w-8 place-items-center rounded-xl text-gray-400 hover:bg-rose-50 hover:text-rose-600">
                  <IconTrash size={15} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <Sheet open={doneOpen} onClose={() => !busy && setDoneOpen(false)} title={t("完成这件事", "Mark as done")}>
        <p className="text-sm font-medium text-gray-900">{issue.title}</p>
        <label className="mt-3 block">
          <span className="mb-1 block text-sm text-gray-600">{t("怎么处理的（可不填）", "How it was sorted (optional)")}</span>
          <input value={doneNote} onChange={(e) => setDoneNote(e.target.value)} maxLength={500} className="input" placeholder={t("例如：已换排水管", "e.g. drain pipe replaced")} />
        </label>
        <button type="button" disabled={busy} onClick={() => patch({ status: "DONE", doneNote: doneNote.trim() || null, meetingCode: meetingCode ?? null })} className="btn-primary mt-4 flex w-full items-center justify-center gap-1.5 py-2.5">
          <IconCheck size={18} />
          {busy ? t("保存中…", "Saving…") : t("标记完成", "Mark done")}
        </button>
      </Sheet>

      {editing && <IssueSheet open onClose={() => setEditing(false)} people={people} issue={issue} onSaved={onChanged} />}

      <ConfirmDialog
        open={removing}
        danger
        title={t("删除这个问题", "Delete this issue")}
        message={t(`删除「${issue.title}」？`, `Delete "${issue.title}"?`)}
        confirmLabel={t("删除", "Delete")}
        onConfirm={remove}
        onCancel={() => setRemoving(false)}
      />
    </li>
  );
}

const OTHER = "__other__";

/** Add an issue to a meeting, or change one. */
export function IssueSheet({
  open,
  onClose,
  people,
  meetingCode,
  issue,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  people: Person[];
  /** Adding to this meeting */
  meetingCode?: string;
  /** Changing this issue */
  issue?: IssueView;
  onSaved: () => void;
}) {
  const { t } = useLanguage();
  const toast = useToast();
  const [title, setTitle] = useState(issue?.title ?? "");
  const [detail, setDetail] = useState(issue?.detail ?? "");
  const [owner, setOwner] = useState(issue ? (issue.ownerId ?? (issue.owner ? OTHER : "")) : "");
  const [ownerName, setOwnerName] = useState(issue && !issue.ownerId ? (issue.owner ?? "") : "");
  const [followUp, setFollowUp] = useState(issue?.followUpId ?? "");
  const [due, setDue] = useState(issue?.dueDate ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const body = {
        title: title.trim(),
        detail: detail.trim() || null,
        ownerId: owner && owner !== OTHER ? owner : null,
        ownerName: owner === OTHER ? ownerName.trim() || null : null,
        followUpId: followUp || null,
        dueDate: due || null,
      };
      const url = issue ? `/api/meetings/issues/${issue.issueCode}` : `/api/meetings/${meetingCode}/issues`;
      const d = await fetch(url, { method: issue ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
      if (!d.success) return toast.danger(d.message);
      toast.success(d.message);
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const options = (
    <>
      {(["BOSS", "ADMIN", "AGENT", "WORKER"] as const).map((role) => {
        const group = people.filter((p) => p.role === role);
        if (!group.length) return null;
        return (
          <optgroup key={role} label={t(ROLE_LABEL[role].zh, ROLE_LABEL[role].en)}>
            {group.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </optgroup>
        );
      })}
    </>
  );

  return (
    <Sheet open={open} onClose={() => !saving && onClose()} title={issue ? t("改这个问题", "Edit issue") : t("加要解决的问题", "Add an issue")} tall>
      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-sm text-gray-600">{t("要解决的问题", "What needs sorting out")}</span>
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} className="input" placeholder={t("例如：PXC-02 冷气漏水", "e.g. PXC-02 aircon leaking")} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-gray-600">{t("细节（可不填）", "Details (optional)")}</span>
          <textarea value={detail} onChange={(e) => setDetail(e.target.value)} rows={2} maxLength={2000} className="input" />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-sm text-gray-600">{t("谁处理", "Who handles it")}</span>
            <select value={owner} onChange={(e) => setOwner(e.target.value)} className="input">
              <option value="">{t("还没定", "Not decided")}</option>
              {options}
              <option value={OTHER}>{t("其他人（没有账号）", "Someone else (no account)")}</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-gray-600">{t("谁跟进", "Who follows up")}</span>
            <select value={followUp} onChange={(e) => setFollowUp(e.target.value)} className="input">
              <option value="">{t("不用", "Nobody")}</option>
              {options}
            </select>
          </label>
        </div>
        {owner === OTHER && (
          <label className="block">
            <span className="mb-1 block text-sm text-gray-600">{t("处理的人的名字", "Their name")}</span>
            <input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} maxLength={60} className="input" placeholder={t("例如：冷气师傅 Ah Keong", "e.g. aircon technician")} />
          </label>
        )}
        <label className="block">
          <span className="mb-1 block text-sm text-gray-600">{t("期限（可不填）", "Due (optional)")}</span>
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="input" />
        </label>
        <p className="text-xs text-gray-500">{t("处理和跟进的人会收到 email，也会在「我的事项」看到。", "The people handling and following up get an email and see it under My items.")}</p>
        <button type="button" onClick={save} disabled={saving || !title.trim() || (owner === OTHER && !ownerName.trim())} className="btn-primary flex w-full items-center justify-center gap-1.5 py-2.5">
          {issue ? <IconCheck size={18} /> : <IconPlus size={18} />}
          {saving ? t("保存中…", "Saving…") : issue ? t("保存", "Save") : t("加这个问题", "Add issue")}
        </button>
      </div>
    </Sheet>
  );
}

const roundedNow = () => {
  const d = new Date(Date.now() + 8 * 3600_000);
  const m = d.getUTCMinutes() < 30 ? "00" : "30";
  return { date: d.toISOString().slice(0, 10), time: `${String(d.getUTCHours()).padStart(2, "0")}:${m}` };
};

/** Start a meeting record, or change its date, place and people. */
export function MeetingFormSheet({
  open,
  onClose,
  people,
  me,
  meeting,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  people: Person[];
  me: string;
  meeting?: { code: string; title: string; startsAt: string; endsAt: string | null; location: string | null; attendees: { id: string }[]; guests: string[] };
  onSaved: (code: string) => void;
}) {
  const { t } = useLanguage();
  const toast = useToast();
  const start = meeting ? toInputs(meeting.startsAt) : roundedNow();
  const [title, setTitle] = useState(meeting?.title ?? "");
  const [date, setDate] = useState(start.date);
  const [time, setTime] = useState(start.time);
  const [endTime, setEndTime] = useState(meeting?.endsAt ? toInputs(meeting.endsAt).time : "");
  const [location, setLocation] = useState(meeting?.location ?? "");
  const [picked, setPicked] = useState<string[]>(meeting ? meeting.attendees.map((a) => a.id) : [me]);
  const [guests, setGuests] = useState<string[]>(meeting?.guests ?? []);
  const [guest, setGuest] = useState("");
  const [saving, setSaving] = useState(false);

  const toggle = (id: string) => setPicked((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  function addGuest() {
    const g = guest.trim();
    if (g && !guests.includes(g)) setGuests([...guests, g]);
    setGuest("");
  }

  async function save() {
    setSaving(true);
    try {
      const body = {
        title: title.trim(),
        startsAt: fromInputs(date, time),
        endsAt: endTime ? fromInputs(date, endTime) : null,
        location: location.trim() || null,
        attendeeIds: picked,
        guests: guest.trim() ? [...guests, guest.trim()] : guests,
      };
      const d = await fetch(meeting ? `/api/meetings/${meeting.code}` : "/api/meetings", {
        method: meeting ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => r.json());
      if (!d.success) return toast.danger(d.message);
      toast.success(d.message);
      onSaved(meeting?.code ?? d.code);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const count = picked.length + guests.length + (guest.trim() ? 1 : 0);

  return (
    <Sheet open={open} onClose={() => !saving && onClose()} title={meeting ? t("改会议资料", "Edit meeting") : t("新会议", "New meeting")} tall>
      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-sm text-gray-600">{t("会议主题", "Topic")}</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} className="input" placeholder={t("例如：每周例会", "e.g. Weekly meeting")} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-gray-600">{t("日期", "Date")}</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-sm text-gray-600">{t("开始", "Start")}</span>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="input" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-gray-600">{t("结束（可不填）", "End (optional)")}</span>
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="input" />
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-sm text-gray-600">{t("地点", "Place")}</span>
          <input value={location} onChange={(e) => setLocation(e.target.value)} maxLength={120} className="input" placeholder={t("例如：公司办公室 / PXC 单位 / Google Meet", "e.g. office / unit / Google Meet")} />
        </label>

        <div>
          <span className="mb-1 block text-sm text-gray-600">
            {t("参加的人", "Who's there")} <b className="text-gray-900">{t(`· ${count} 人`, `· ${count}`)}</b>
          </span>
          <div className="flex flex-wrap gap-1.5">
            {people.map((p) => {
              const on = picked.includes(p.id);
              const locked = p.id === me && !meeting;
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={locked}
                  aria-pressed={on}
                  onClick={() => toggle(p.id)}
                  className={`rounded-full px-3 py-1.5 text-sm ${on ? "bg-brand text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"} ${locked ? "opacity-90" : ""}`}
                >
                  {p.name}
                  <span className={`ml-1 text-[11px] ${on ? "text-white/80" : "text-gray-400"}`}>{t(ROLE_LABEL[p.role]?.zh ?? p.role, ROLE_LABEL[p.role]?.en ?? p.role)}</span>
                </button>
              );
            })}
          </div>
          <p className="mt-1 text-xs text-gray-500">{t("有账号的人可以用自己的账号写备注。", "People with an account write their own notes from it.")}</p>
        </div>

        <div>
          <span className="mb-1 block text-sm text-gray-600">{t("其他参加的人（没有账号，例如房东、师傅）", "Others there (no account, e.g. landlord)")}</span>
          {guests.length > 0 && (
            <div className="mb-1.5 flex flex-wrap gap-1.5">
              {guests.map((g) => (
                <span key={g} className="flex items-center gap-1 rounded-full bg-amber-50 py-1 pl-3 pr-1 text-sm text-amber-900">
                  {g}
                  <button type="button" onClick={() => setGuests(guests.filter((x) => x !== g))} aria-label={t(`去掉 ${g}`, `Remove ${g}`)} className="grid h-6 w-6 place-items-center rounded-full hover:bg-amber-100">
                    <IconX size={13} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              value={guest}
              onChange={(e) => setGuest(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addGuest();
                }
              }}
              maxLength={60}
              className="input"
              placeholder={t("名字", "Name")}
            />
            <button type="button" onClick={addGuest} disabled={!guest.trim()} className="btn-soft shrink-0 px-4">
              {t("加", "Add")}
            </button>
          </div>
        </div>

        <button type="button" onClick={save} disabled={saving || !title.trim() || !date || !time} className="btn-primary flex w-full items-center justify-center gap-1.5 py-2.5">
          {meeting ? <IconCheck size={18} /> : <IconPlus size={18} />}
          {saving ? t("保存中…", "Saving…") : meeting ? t("保存", "Save") : t("开始记录", "Start the record")}
        </button>
      </div>
    </Sheet>
  );
}
