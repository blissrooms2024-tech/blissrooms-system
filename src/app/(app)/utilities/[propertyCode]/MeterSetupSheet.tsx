"use client";

import { useState } from "react";
import Sheet from "@/components/Sheet";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useLanguage } from "@/components/LanguageProvider";
import { useToast } from "@/components/Toast";
import { IconPlus, IconTrash } from "@/components/icons";
import { KIND_LABELS, UTILITY_KINDS, type UtilityKind } from "@/lib/utilitySplit";
import type { UnitBilling } from "@/lib/utilityBilling";

type Meter = UnitBilling["meters"][number];

const segBtn = (on: boolean) => `flex-1 rounded-[10px] px-2 py-2 text-sm font-medium ${on ? "bg-white text-brand shadow-sm" : "text-gray-500"}`;

/** 电表设定 — which meters this unit has, where each one is, and how it's read. */
export default function MeterSetupSheet({
  open,
  onClose,
  data,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  data: UnitBilling;
  onChanged: () => void;
}) {
  const { t } = useLanguage();
  const toast = useToast();
  const blank = (kind: UtilityKind = "ELECTRIC") => ({
    kind,
    roomId: "",
    inputMode: kind === "ELECTRIC" ? "USAGE" : "READING",
    startReading: "",
    meterNo: "",
    label: "",
  });
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<Meter | null>(null);

  const roomsWithAc = new Set(data.meters.filter((m) => m.kind === "AC" && m.roomId).map((m) => m.roomId));
  function pickKind(kind: UtilityKind) {
    // Aircon meters belong to a room; electricity and washer + dryer are usually one per unit.
    const firstRoom = kind === "AC" ? (data.rooms.find((r) => !roomsWithAc.has(r.id))?.id ?? "") : "";
    setForm({ ...blank(kind), roomId: firstRoom });
  }

  async function add() {
    setSaving(true);
    try {
      const body = {
        kind: form.kind,
        roomId: form.roomId || null,
        inputMode: form.inputMode,
        startReading: form.inputMode === "READING" && form.startReading !== "" ? Number(form.startReading) : null,
        meterNo: form.meterNo || null,
        label: form.label || null,
      };
      const d = await fetch(`/api/utilities/${data.unit.propertyCode}/meters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => r.json());
      if (!d.success) return toast.danger(d.message);
      toast.success(d.message);
      // Ready for the next one: an aircon meter moves on to the next room without one.
      const used = new Set([...roomsWithAc, form.roomId]);
      const kind = form.kind as UtilityKind;
      setForm({ ...blank(kind), roomId: kind === "AC" ? (data.rooms.find((r) => !used.has(r.id))?.id ?? "") : "" });
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!removing) return;
    const d = await fetch(`/api/utilities/meters/${removing.id}`, { method: "DELETE" }).then((r) => r.json());
    setRemoving(null);
    if (!d.success) return toast.danger(d.message);
    toast.success(d.message);
    onChanged();
  }

  const where = (m: Meter) => m.roomCode ?? t("整个单位共用", "Whole unit");

  return (
    <>
      <Sheet open={open} onClose={onClose} title={t(`${data.unit.propertyCode} 的电表`, `${data.unit.propertyCode} meters`)} tall>
        {data.meters.length > 0 ? (
          <ul className="mb-4 divide-y divide-gray-100 rounded-2xl border border-gray-100">
            {data.meters.map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-3 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-gray-900">
                    {t(KIND_LABELS[m.kind].zh, KIND_LABELS[m.kind].en)} · {where(m)}
                  </span>
                  <span className="block text-xs text-gray-500">
                    {m.inputMode === "READING" ? t("抄读数", "Reading") : t("直接填度数", "kWh entered directly")}
                    {m.previous !== null && m.inputMode === "READING" ? t(` · 上次读数 ${m.previous}`, ` · last ${m.previous}`) : ""}
                    {m.meterNo ? ` · ${m.meterNo}` : ""}
                  </span>
                </span>
                <button type="button" onClick={() => setRemoving(m)} aria-label={t("删除电表", "Remove meter")} className="grid h-9 w-9 place-items-center rounded-xl text-gray-400 hover:bg-rose-50 hover:text-rose-600">
                  <IconTrash size={18} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-4 rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-600">
            {t("这个单位还没有电表。按单位的情况加：不包电费的加一个电费电表，洗衣机烘干机加一个，冷气有独立电表的每间房加一个。", "No meters yet. Add one electricity meter if rent excludes electricity, one for the washer & dryer, and one per room for aircon on its own meter.")}
          </p>
        )}

        <h3 className="mb-2 text-sm font-semibold text-gray-900">{t("加一个电表", "Add a meter")}</h3>
        <div className="space-y-3">
          <div className="flex rounded-xl bg-gray-100 p-0.5">
            {UTILITY_KINDS.map((k) => (
              <button key={k} type="button" onClick={() => pickKind(k)} className={segBtn(form.kind === k)}>
                {t(KIND_LABELS[k].zh, KIND_LABELS[k].en)}
              </button>
            ))}
          </div>
          <label className="block">
            <span className="mb-1 block text-sm text-gray-600">{t("电表在哪里", "Where")}</span>
            <select value={form.roomId} onChange={(e) => setForm({ ...form, roomId: e.target.value })} className="input">
              <option value="">{t("整个单位共用（大家平分）", "Whole unit (shared)")}</option>
              {data.rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.roomCode}
                  {roomsWithAc.has(r.id) && form.kind === "AC" ? t("（已有冷气电表）", " (has an aircon meter)") : ""}
                </option>
              ))}
            </select>
          </label>
          <div>
            <span className="mb-1 block text-sm text-gray-600">{t("每个月怎么填", "Each month you enter")}</span>
            <div className="flex rounded-xl bg-gray-100 p-0.5">
              <button type="button" onClick={() => setForm({ ...form, inputMode: "READING" })} className={segBtn(form.inputMode === "READING")}>
                {t("电表读数", "The reading")}
              </button>
              <button type="button" onClick={() => setForm({ ...form, inputMode: "USAGE" })} className={segBtn(form.inputMode === "USAGE")}>
                {t("用了多少度", "kWh used")}
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {form.inputMode === "READING"
                ? t("填电表上的数字，系统自动减掉上个月的读数。", "Type the number on the meter; last month's reading is subtracted for you.")
                : t("直接填这个月用了多少度（例如看 TNB 账单）。", "Type the kWh used this month (e.g. from the TNB bill).")}
            </p>
          </div>
          {form.inputMode === "READING" && (
            <label className="block">
              <span className="mb-1 block text-sm text-gray-600">{t("现在电表上的读数", "Reading on the meter now")}</span>
              <input type="number" inputMode="decimal" min="0" value={form.startReading} onChange={(e) => setForm({ ...form, startReading: e.target.value })} className="input" placeholder="0" />
              <span className="mt-1 block text-xs text-gray-500">{t("第一次开单会从这个读数开始算。", "The first bill counts from this reading.")}</span>
            </label>
          )}
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 block text-sm text-gray-600">{t("电表号码（可不填）", "Meter no. (optional)")}</span>
              <input value={form.meterNo} onChange={(e) => setForm({ ...form, meterNo: e.target.value })} className="input" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-gray-600">{t("备注名称（可不填）", "Name (optional)")}</span>
              <input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} className="input" />
            </label>
          </div>
          <button
            type="button"
            onClick={add}
            disabled={saving || (form.inputMode === "READING" && form.startReading === "")}
            className="btn-primary flex w-full items-center justify-center gap-1.5 py-2.5"
          >
            <IconPlus size={18} />
            {saving ? t("保存中…", "Saving…") : t("加这个电表", "Add meter")}
          </button>
        </div>
      </Sheet>
      <ConfirmDialog
        open={!!removing}
        danger
        title={t("删除电表", "Remove meter")}
        message={
          removing
            ? t(
                `删除 ${KIND_LABELS[removing.kind].zh}电表（${where(removing)}）？开过账单的电表只会停用，以前的记录还在。`,
                `Remove the ${KIND_LABELS[removing.kind].en} meter (${where(removing)})? A meter that has been billed is only switched off; past records stay.`
              )
            : ""
        }
        confirmLabel={t("删除", "Remove")}
        onConfirm={remove}
        onCancel={() => setRemoving(null)}
      />
    </>
  );
}
