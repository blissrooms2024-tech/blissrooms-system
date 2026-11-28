"use client";
import { useCallback, useEffect, useState } from "react";
import Sheet from "@/components/Sheet";
import { useToast } from "@/components/Toast";
import { useLanguage } from "@/components/LanguageProvider";
import { IconAlert, IconCheck, IconMinus, IconPen, IconPlus, IconX } from "@/components/icons";
import { fmtDate } from "@/lib/format";
import { BASIC_FURNITURE, FURNITURE, furnitureLabel, type FurnitureItem } from "@/lib/roomFurniture";

interface Data {
  isCarpark: boolean;
  items: FurnitureItem[] | null;
  confirmedAt: string | null;
  confirmedBy: string | null;
  canEdit: boolean;
}

const chip = (on: boolean) =>
  `h-8 rounded-full px-3 text-[13px] font-medium ${on ? "bg-brand text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`;

/**
 * 家具 on the room page: what the room has, as management confirmed it after renovation.
 * Boss / Admin set it (the six basics are ticked from the start; add-ons and typed-in extras on
 * top); at move-in the tenant only ticks whether each one is there.
 */
export default function RoomFurniture({ roomCode }: { roomCode: string }) {
  const { t, locale } = useLanguage();
  const [data, setData] = useState<Data | null>(null);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/rooms/${roomCode}/furniture`);
      const d = await res.json();
      if (d.success) setData(d);
    } catch {
      // The rest of the room page still works; the card just stays hidden.
    }
  }, [roomCode]);

  useEffect(() => {
    // setState happens after the fetch's await, not synchronously in the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  if (!data || data.isCarpark) return null;
  const items = data.items;

  return (
    <section aria-label={t("家具", "Furniture")} className="rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(30,27,46,0.05)]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-[15px] font-semibold text-gray-900">
          {t("家具", "Furniture")}
          {items && <span className="ml-1.5 text-[12px] font-normal text-gray-400">{items.length}</span>}
        </h3>
        {data.canEdit && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex h-8 items-center gap-1 rounded-lg bg-gray-100 px-2.5 text-[13px] font-semibold text-gray-700 hover:bg-gray-200"
          >
            {items ? <IconPen size={14} /> : <IconPlus size={14} />}
            {items ? t("改", "Edit") : t("设定家具", "Set up")}
          </button>
        )}
      </div>

      {!items ? (
        <p className="text-[13px] text-gray-500">
          {t("还没设定这间房有什么家具。装修好后设定，租客入住时会按这个清单打勾。", "Not set up yet. Once the room is done up, list its furniture — the tenant ticks this list at move-in.")}
        </p>
      ) : (
        <>
          <ul className="flex flex-wrap gap-1.5">
            {items.map((i, n) => (
              <li key={`${i.key}-${n}`} className="rounded-full bg-gray-100 px-2.5 py-1 text-[12.5px] text-gray-800">
                {furnitureLabel(i, locale)}
              </li>
            ))}
            {items.length === 0 && <li className="text-[13px] text-gray-500">{t("没有家具", "No furniture")}</li>}
          </ul>
          <p className={`mt-2 flex items-center gap-1 text-[12px] ${data.confirmedAt ? "text-teal-700" : "text-amber-700"}`}>
            {data.confirmedAt ? <IconCheck size={14} /> : <IconAlert size={14} />}
            {data.confirmedAt
              ? t(`${data.confirmedBy ?? ""} ${fmtDate(data.confirmedAt)} 确认`, `Confirmed by ${data.confirmedBy ?? ""} on ${fmtDate(data.confirmedAt)}`)
              : t("还没确认：装修好后，看过房间再按「确认」", "Not confirmed yet: check the room once it's done up, then confirm")}
          </p>
        </>
      )}

      {editing && (
        <FurnitureSheet
          roomCode={roomCode}
          start={items ?? BASIC_FURNITURE}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            load();
          }}
        />
      )}
    </section>
  );
}

function FurnitureSheet({
  roomCode,
  start,
  onClose,
  onSaved,
}: {
  roomCode: string;
  start: FurnitureItem[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t, locale } = useLanguage();
  const toast = useToast();
  const [items, setItems] = useState<FurnitureItem[]>(start);
  const [custom, setCustom] = useState("");
  const [saving, setSaving] = useState(false);

  const has = (key: string) => items.find((i) => i.key === key);
  const toggle = (key: string) => setItems((list) => (list.some((i) => i.key === key) ? list.filter((i) => i.key !== key) : [...list, { key }]));
  const patch = (key: string, p: Partial<FurnitureItem>) => setItems((list) => list.map((i) => (i.key === key ? { ...i, ...p } : i)));
  const customs = items.filter((i) => i.key === "custom");

  function addCustom() {
    const name = custom.trim();
    if (!name) return;
    if (customs.some((c) => c.label?.toLowerCase() === name.toLowerCase())) return setCustom("");
    setItems((list) => [...list, { key: "custom", label: name.slice(0, 40) }]);
    setCustom("");
  }

  async function save(confirm: boolean) {
    const fan = has("fan");
    if (fan && !fan.variant) return toast.warning(t("风扇要选遥控还是 Regulator", "Fan: remote or regulator?"));
    setSaving(true);
    try {
      const res = await fetch(`/api/rooms/${roomCode}/furniture`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, confirm }),
      });
      const d = await res.json();
      if (!d.success) return toast.danger(d.message);
      toast.success(d.message);
      onSaved();
    } catch {
      toast.danger(t("出错，请稍后再试", "Something went wrong — please try again"));
    } finally {
      setSaving(false);
    }
  }

  const basics = FURNITURE.filter((d) => d.basic);
  const extras = FURNITURE.filter((d) => !d.basic);

  return (
    <Sheet open onClose={() => !saving && onClose()} title={t(`${roomCode} 的家具`, `${roomCode} furniture`)} tall>
      <div className="space-y-4">
        <div>
          <p className="mb-1.5 text-sm text-gray-600">{t("每间房都有（没有就取消勾）", "Every room has these (untick what's missing)")}</p>
          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100">
            {basics.map((d) => {
              const it = has(d.key);
              return (
                <li key={d.key} className="px-3 py-2">
                  <label className="flex cursor-pointer items-center gap-2.5">
                    <input type="checkbox" checked={!!it} onChange={() => toggle(d.key)} className="h-5 w-5 accent-brand" />
                    <span className="text-[14px] text-gray-900">{locale === "en" ? d.en : d.zh}</span>
                  </label>
                  {it && d.variants && (
                    <div role="radiogroup" aria-label={t(`${d.zh}怎么开`, `${d.en} control`)} className="mt-2 grid max-w-xs grid-cols-2 gap-1 rounded-xl bg-gray-200/60 p-1">
                      {d.variants.map((v) => (
                        <button
                          key={v.key}
                          type="button"
                          role="radio"
                          aria-checked={it.variant === v.key}
                          onClick={() => patch(d.key, { variant: v.key })}
                          className={`h-8 rounded-lg text-[13px] font-medium ${it.variant === v.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-600"}`}
                        >
                          {locale === "en" ? v.en : v.zh}
                        </button>
                      ))}
                    </div>
                  )}
                  {it && d.variants && !it.variant && <p className="mt-1 text-xs text-amber-700">{t("选一个", "Pick one")}</p>}
                </li>
              );
            })}
          </ul>
        </div>

        <div>
          <p className="mb-1.5 text-sm text-gray-600">{t("这间房还有", "This room also has")}</p>
          <div className="flex flex-wrap gap-1.5">
            {extras.map((d) => {
              const it = has(d.key);
              return (
                <span key={d.key} className="inline-flex items-center gap-1">
                  <button type="button" aria-pressed={!!it} onClick={() => toggle(d.key)} className={chip(!!it)}>
                    {locale === "en" ? d.en : d.zh}
                  </button>
                  {it && d.qty && (
                    <span className="inline-flex items-center rounded-full bg-gray-100">
                      <button
                        type="button"
                        aria-label={t("少一个", "One fewer")}
                        onClick={() => patch(d.key, { qty: Math.max(1, (it.qty ?? 1) - 1) })}
                        className="grid h-8 w-8 place-items-center text-gray-600"
                      >
                        <IconMinus size={14} />
                      </button>
                      <span className="min-w-[1.5rem] text-center text-[13px] font-semibold tabular-nums">{it.qty ?? 1}</span>
                      <button
                        type="button"
                        aria-label={t("多一个", "One more")}
                        onClick={() => patch(d.key, { qty: Math.min(20, (it.qty ?? 1) + 1) })}
                        className="grid h-8 w-8 place-items-center text-gray-600"
                      >
                        <IconPlus size={14} />
                      </button>
                    </span>
                  )}
                </span>
              );
            })}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-sm text-gray-600">{t("其他（自己写）", "Something else")}</p>
          {customs.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {customs.map((c) => (
                <span key={c.label} className="inline-flex h-8 items-center gap-1 rounded-full bg-brand pl-3 pr-1 text-[13px] font-medium text-white">
                  {c.label}
                  <button
                    type="button"
                    aria-label={t(`去掉 ${c.label}`, `Remove ${c.label}`)}
                    onClick={() => setItems((list) => list.filter((i) => !(i.key === "custom" && i.label === c.label)))}
                    className="grid h-6 w-6 place-items-center rounded-full hover:bg-white/20"
                  >
                    <IconX size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              className="input"
              value={custom}
              maxLength={40}
              placeholder={t("例如 灭火器、衣架", "e.g. Fire extinguisher")}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustom();
                }
              }}
            />
            <button type="button" onClick={addCustom} className="shrink-0 rounded-xl bg-gray-100 px-3.5 text-sm font-semibold text-gray-700 hover:bg-gray-200">
              {t("加", "Add")}
            </button>
          </div>
        </div>

        <p className="text-xs text-gray-500">
          {t(
            `一共 ${items.length} 样：${items.map((i) => furnitureLabel(i, "zh")).join("、") || "没有"}`,
            `${items.length} item${items.length === 1 ? "" : "s"}: ${items.map((i) => furnitureLabel(i, "en")).join(", ") || "none"}`
          )}
        </p>

        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => save(false)} disabled={saving} className="btn-soft py-2.5">
            {t("先保存", "Save draft")}
          </button>
          <button type="button" onClick={() => save(true)} disabled={saving} className="btn-primary flex items-center justify-center gap-1.5 py-2.5">
            <IconCheck size={17} />
            {saving ? t("保存中…", "Saving…") : t("装修好了，确认", "Done up — confirm")}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
