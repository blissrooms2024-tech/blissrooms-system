"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Sheet from "@/components/Sheet";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useLanguage } from "@/components/LanguageProvider";
import { useToast } from "@/components/Toast";
import { IconAlert, IconBuilding, IconCheck, IconHome, IconPen, IconPlus, IconTrash } from "@/components/icons";
import { fmtDate } from "@/lib/format";

type Note = { id: string; text: string; by: string; at: string };
type Building = { id: string; name: string; units: { code: string; name: string }[] };
type Data = {
  unit: { code: string; name: string };
  building: Building | null;
  buildingNotes: Note[];
  unitNotes: Note[];
  canEdit: boolean;
  buildings: { id: string; name: string; units: number }[];
};

/** 注意事项 for one unit: its building's (shared by every unit in that condo / apartment) and
 * its own.
 *  - "embedded": the full list on the unit page, where Boss / Admin add, change and delete them
 *    and set which building the unit is in.
 *  - "compact": a short amber box on room and contract pages, so they're seen while working on
 *    that room; nothing shows when there are none. */
export default function UnitNotes({ propertyCode, variant }: { propertyCode: string; variant: "embedded" | "compact" }) {
  const { t } = useLanguage();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<{ note?: Note; scope?: "UNIT" | "BUILDING" } | null>(null);
  const [pickBuilding, setPickBuilding] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/properties/${propertyCode}/notes`);
      const d = await res.json();
      if (d.success) {
        setData(d);
        setError("");
      } else setError(d.message);
    } catch {
      setError(t("注意事项载入失败", "Couldn't load the notes"));
    }
  }, [propertyCode, t]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- first load; state is set after the fetch resolves
    void load();
  }, [load]);

  if (variant === "compact") {
    if (!data) return null;
    const all = [...data.buildingNotes, ...data.unitNotes];
    if (!all.length) return null;
    const shown = all.slice(0, 4);
    return (
      <div className="rounded-2xl bg-amber-50 px-3.5 py-2.5 ring-1 ring-amber-200/70">
        <p className="flex items-center gap-1.5 text-[13px] font-semibold text-amber-800">
          <IconAlert size={15} className="shrink-0" />
          {t("注意事项", "Keep in mind")}
          <span className="truncate font-normal text-amber-700/80">· {data.building?.name ?? data.unit.name}</span>
        </p>
        <ul className="mt-1 space-y-0.5">
          {shown.map((n) => (
            <li key={n.id} className="flex gap-1.5 text-[13px] leading-snug text-amber-950">
              <span aria-hidden="true" className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-amber-500" />
              <span className="min-w-0 whitespace-pre-wrap break-words">{n.text}</span>
            </li>
          ))}
        </ul>
        {(all.length > shown.length || data.canEdit) && (
          <Link href={`/units/${propertyCode}`} className="mt-1 inline-block text-[12px] font-medium text-amber-800 underline underline-offset-2">
            {all.length > shown.length ? t(`还有 ${all.length - shown.length} 条，去楼盘页看`, `${all.length - shown.length} more on the property page`) : t("去楼盘页改", "Change on the property page")}
          </Link>
        )}
      </div>
    );
  }

  return (
    <section className="mt-4 border-t border-gray-100 pt-3.5">
      <div className="flex items-center justify-between gap-2">
        <h4 className="flex items-center gap-1.5 text-sm font-semibold text-brand">
          <IconAlert size={16} className="text-amber-600" />
          {t("注意事项", "Keep in mind")}
          {data && <span className="font-normal text-gray-400">{data.buildingNotes.length + data.unitNotes.length}</span>}
        </h4>
        {data?.canEdit && (
          <button
            type="button"
            onClick={() => setEditing({ scope: data.building ? "BUILDING" : "UNIT" })}
            className="flex h-8 items-center gap-1 rounded-lg bg-brand-light px-2.5 text-[12px] font-semibold text-brand hover:bg-violet-100"
          >
            <IconPlus size={14} />
            {t("加一条", "Add")}
          </button>
        )}
      </div>

      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
      {!data && !error && <div className="mt-2 h-16 animate-pulse rounded-xl bg-gray-50 motion-reduce:animate-none" />}

      {data && (
        <div className="mt-2 space-y-3">
          <div>
            <div className="flex items-center justify-between gap-2">
              <p className="flex min-w-0 items-center gap-1 text-[12px] text-gray-500">
                <IconBuilding size={13} className="shrink-0" />
                {data.building ? (
                  <span className="min-w-0 truncate">
                    {t("整栋", "Whole building")} · <b className="font-semibold text-gray-800">{data.building.name}</b>
                    {data.building.units.length > 1 && t(`（${data.building.units.length} 个单位一起看到）`, ` (shown on ${data.building.units.length} units)`)}
                  </span>
                ) : (
                  <span>{t("还没设定属于哪栋 condo / apartment", "Not in a building yet")}</span>
                )}
              </p>
              {data.canEdit && (
                <button type="button" onClick={() => setPickBuilding(true)} className="shrink-0 text-[12px] font-medium text-brand hover:underline">
                  {data.building ? t("改", "Change") : t("设定", "Set")}
                </button>
              )}
            </div>
            <NoteList notes={data.buildingNotes} canEdit={data.canEdit} onEdit={(note) => setEditing({ note })} empty={data.building ? t("还没有", "None yet") : ""} />
          </div>

          <div>
            <p className="flex items-center gap-1 text-[12px] text-gray-500">
              <IconHome size={13} className="shrink-0" />
              {t("只是这个单位", "This unit only")} · <b className="font-semibold text-gray-800">{data.unit.code}</b>
            </p>
            <NoteList notes={data.unitNotes} canEdit={data.canEdit} onEdit={(note) => setEditing({ note })} empty={t("还没有", "None yet")} />
          </div>
        </div>
      )}

      {data && editing && (
        <NoteSheet
          key={editing.note?.id ?? "new"}
          propertyCode={propertyCode}
          data={data}
          note={editing.note}
          initialScope={editing.scope ?? "UNIT"}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
        />
      )}
      {data && pickBuilding && (
        <BuildingSheet
          propertyCode={propertyCode}
          data={data}
          onClose={() => setPickBuilding(false)}
          onSaved={() => {
            setPickBuilding(false);
            void load();
          }}
        />
      )}
    </section>
  );
}

function NoteList({ notes, canEdit, onEdit, empty }: { notes: Note[]; canEdit: boolean; onEdit: (n: Note) => void; empty: string }) {
  const { t } = useLanguage();
  if (!notes.length) return empty ? <p className="mt-1 pl-[17px] text-[13px] text-gray-400">{empty}</p> : null;
  return (
    <ul className="mt-1.5 space-y-1.5">
      {notes.map((n) => (
        <li key={n.id} className="flex items-start gap-2 rounded-xl bg-amber-50/70 py-2 pl-3 pr-1">
          <span aria-hidden="true" className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
          <div className="min-w-0 flex-1">
            <p className="whitespace-pre-wrap break-words text-[14px] leading-snug text-gray-900">{n.text}</p>
            <p className="mt-0.5 text-[11px] text-gray-400">
              {n.by} · {fmtDate(n.at)}
            </p>
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={() => onEdit(n)}
              aria-label={t(`改：${n.text.slice(0, 20)}`, `Edit: ${n.text.slice(0, 20)}`)}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-gray-400 hover:bg-white hover:text-brand"
            >
              <IconPen size={15} />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Add a note (to the whole building, or this unit only) or change / delete one. */
function NoteSheet({
  propertyCode,
  data,
  note,
  initialScope,
  onClose,
  onSaved,
}: {
  propertyCode: string;
  data: Data;
  note?: Note;
  initialScope: "UNIT" | "BUILDING";
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useLanguage();
  const toast = useToast();
  const [text, setText] = useState(note?.text ?? "");
  const [scope, setScope] = useState<"UNIT" | "BUILDING">(data.building ? initialScope : "UNIT");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function call(url: string, method: string, body?: unknown) {
    setSaving(true);
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
      const d = await res.json();
      if (d.success) {
        toast.success(d.message);
        onSaved();
      } else toast.danger(d.message);
    } catch {
      toast.danger(t("系统出错，请稍后再试", "System error — please try again later"));
    }
    setSaving(false);
  }

  const save = () => (note ? call(`/api/property-notes/${note.id}`, "PATCH", { text }) : call(`/api/properties/${propertyCode}/notes`, "POST", { scope, text }));

  return (
    <>
      <Sheet open onClose={() => !saving && onClose()} title={note ? t("改注意事项", "Edit note") : t("加注意事项", "Add a note")}>
        <div className="space-y-3">
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            maxLength={1000}
            className="input"
            placeholder={t("例如：每个单位最多可以申请 8 张 access card", "e.g. Max 8 access cards per unit")}
          />

          {!note && (
            <div>
              <span className="mb-1 block text-sm text-gray-600">{t("写给", "Applies to")}</span>
              <div className="grid gap-2">
                {data.building && (
                  <ScopeOption
                    on={scope === "BUILDING"}
                    onClick={() => setScope("BUILDING")}
                    title={t(`整栋 ${data.building.name}`, `All of ${data.building.name}`)}
                    sub={
                      data.building.units.length > 1
                        ? t(`${data.building.units.map((u) => u.code).join("、")} 都会看到`, `Shown on ${data.building.units.map((u) => u.code).join(", ")}`)
                        : t("这栋以后加的单位也会看到", "Units added to this building later see it too")
                    }
                  />
                )}
                <ScopeOption
                  on={scope === "UNIT"}
                  onClick={() => setScope("UNIT")}
                  title={t(`只是 ${data.unit.code} 这个单位`, `Only ${data.unit.code}`)}
                  sub={t("例如这个单位的钥匙、设备、屋主的要求", "e.g. this unit's keys, appliances, owner's requests")}
                />
              </div>
            </div>
          )}

          <button type="button" onClick={save} disabled={saving || !text.trim()} className="btn-primary flex w-full items-center justify-center gap-1.5 py-2.5">
            <IconCheck size={18} />
            {saving ? t("保存中…", "Saving…") : t("保存", "Save")}
          </button>
          {note && (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              disabled={saving}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-rose-50 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-100"
            >
              <IconTrash size={16} />
              {t("删除这条", "Delete this note")}
            </button>
          )}
        </div>
      </Sheet>
      <ConfirmDialog
        open={confirmDelete}
        danger
        title={t("删除这条注意事项？", "Delete this note?")}
        message={note?.text ?? ""}
        confirmLabel={t("删除", "Delete")}
        onConfirm={() => {
          setConfirmDelete(false);
          if (note) void call(`/api/property-notes/${note.id}`, "DELETE");
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}

function ScopeOption({ on, onClick, title, sub }: { on: boolean; onClick: () => void; title: string; sub: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`flex items-start gap-2.5 rounded-xl px-3 py-2.5 text-left ring-1 ${on ? "bg-brand-light ring-brand" : "bg-white ring-gray-200 hover:bg-gray-50"}`}
    >
      <span className={`mt-0.5 grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border-2 ${on ? "border-brand bg-brand text-white" : "border-gray-300"}`}>
        {on && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-gray-900">{title}</span>
        <span className="block text-xs text-gray-500">{sub}</span>
      </span>
    </button>
  );
}

/** Which condo / apartment this unit is in — pick one, or start a new one; and rename the current one. */
function BuildingSheet({ propertyCode, data, onClose, onSaved }: { propertyCode: string; data: Data; onClose: () => void; onSaved: () => void }) {
  const { t } = useLanguage();
  const toast = useToast();
  const NEW = "__new__";
  const [choice, setChoice] = useState(data.building?.id ?? (data.buildings[0]?.id || NEW));
  const [newName, setNewName] = useState("");
  const [rename, setRename] = useState(data.building?.name ?? "");
  const [saving, setSaving] = useState(false);

  async function call(url: string, method: string, body: unknown) {
    setSaving(true);
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await res.json();
      if (d.success) {
        toast.success(d.message);
        onSaved();
      } else toast.danger(d.message);
    } catch {
      toast.danger(t("系统出错，请稍后再试", "System error — please try again later"));
    }
    setSaving(false);
  }

  const others = data.building ? data.building.units.filter((u) => u.code !== data.unit.code) : [];

  return (
    <Sheet open onClose={() => !saving && onClose()} title={t("属于哪栋 condo / apartment", "Which building")} tall>
      <div className="space-y-4">
        <p className="text-sm text-gray-500">
          {t(
            "同一栋的单位会一起看到「整栋」的注意事项，例如门卡上限、车牌登记。",
            "Units in the same building all see its notes, e.g. access card limits or car plate registration."
          )}
        </p>
        <div>
          <span className="mb-1 block text-sm text-gray-600">{t(`${data.unit.code} 属于`, `${data.unit.code} is in`)}</span>
          <select value={choice} onChange={(e) => setChoice(e.target.value)} className="input">
            {data.buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} {t(`（${b.units} 个单位）`, `(${b.units} unit${b.units === 1 ? "" : "s"})`)}
              </option>
            ))}
            <option value={NEW}>{t("＋ 新的 condo / apartment", "+ A new building")}</option>
          </select>
          {choice === NEW && (
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              maxLength={120}
              className="input mt-2"
              placeholder={t("例如：Pixel City Residence", "e.g. Pixel City Residence")}
              aria-label={t("新的名字", "New building name")}
            />
          )}
          <button
            type="button"
            disabled={saving || choice === data.building?.id || (choice === NEW && !newName.trim())}
            onClick={() => call(`/api/properties/${propertyCode}/notes`, "PUT", choice === NEW ? { name: newName } : { buildingId: choice })}
            className="btn-primary mt-2 flex w-full items-center justify-center gap-1.5 py-2.5"
          >
            <IconCheck size={18} />
            {t("保存", "Save")}
          </button>
        </div>

        {data.building && (
          <div className="border-t border-gray-100 pt-4">
            <span className="mb-1 block text-sm text-gray-600">
              {t(`改「${data.building.name}」的名字`, `Rename “${data.building.name}”`)}
              {others.length > 0 && <span className="text-gray-400">{t(`（${others.map((u) => u.code).join("、")} 一起改）`, ` (also on ${others.map((u) => u.code).join(", ")})`)}</span>}
            </span>
            <input value={rename} onChange={(e) => setRename(e.target.value)} maxLength={120} className="input" aria-label={t("新名字", "New name")} />
            <button
              type="button"
              disabled={saving || !rename.trim() || rename.trim() === data.building.name}
              onClick={() => call(`/api/buildings/${data.building!.id}`, "PATCH", { name: rename })}
              className="btn-soft mt-2 flex w-full items-center justify-center gap-1.5 py-2.5"
            >
              <IconPen size={16} />
              {t("改名字", "Rename")}
            </button>
          </div>
        )}
      </div>
    </Sheet>
  );
}
