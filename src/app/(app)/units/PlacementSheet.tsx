"use client";
import { useMemo, useState } from "react";
import Sheet from "@/components/Sheet";
import { useToast } from "@/components/Toast";
import { useLanguage } from "@/components/LanguageProvider";
import { IconCheck } from "@/components/icons";
import type { PickUnit } from "@/components/UnitRoomSelect";

/**
 * 设定楼盘 / 单位号码: every unit on one screen, its condo and unit number side by side, so the
 * 楼盘 → 单位号码 → 房间 dropdowns read the way the team talks ("Pixel City Residence, B-12-03").
 * Only rows that changed are sent.
 */
export default function PlacementSheet({ units, onClose, onSaved }: { units: PickUnit[]; onClose: () => void; onSaved: () => void }) {
  const { t } = useLanguage();
  const toast = useToast();
  const sorted = useMemo(() => [...units].sort((a, b) => a.propertyCode.localeCompare(b.propertyCode)), [units]);
  // A unit whose 楼盘 is still just its own name was never placed in a condo: start that box empty.
  const startBuilding = (u: PickUnit) => (u.building && u.building !== u.name ? u.building : "");
  const [rows, setRows] = useState(() =>
    Object.fromEntries(sorted.map((u) => [u.propertyCode, { building: startBuilding(u), unitNo: u.unitNo ?? "" }]))
  );
  const [saving, setSaving] = useState(false);
  const names = useMemo(
    () => [...new Set([...units.map(startBuilding), ...Object.values(rows).map((r) => r.building.trim())].filter(Boolean))].sort(),
    [units, rows]
  );
  const set = (code: string, k: "building" | "unitNo", v: string) => setRows((r) => ({ ...r, [code]: { ...r[code], [k]: v } }));

  async function save() {
    const changed = sorted
      .filter((u) => rows[u.propertyCode].building.trim() !== startBuilding(u) || rows[u.propertyCode].unitNo.trim() !== (u.unitNo ?? ""))
      .map((u) => ({ propertyCode: u.propertyCode, building: rows[u.propertyCode].building.trim(), unitNo: rows[u.propertyCode].unitNo.trim() }));
    if (!changed.length) return onClose();
    setSaving(true);
    try {
      const res = await fetch("/api/properties/placement", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ units: changed }),
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

  return (
    <Sheet open onClose={() => !saving && onClose()} title={t("设定楼盘 / 单位号码", "Buildings & unit numbers")} tall>
      <p className="mb-3 text-[13px] text-gray-500">
        {t(
          "每个单位填它在哪个 condo / apartment（楼盘），和它的单位号码。同一个楼盘的名字要写得一样，例如都写 Pixel City Residence。",
          "For each unit: the condo / apartment it's in, and its unit number. Spell a building the same way every time."
        )}
      </p>
      <datalist id="building-names">
        {names.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
      <ul className="space-y-2.5">
        {sorted.map((u) => (
          <li key={u.propertyCode} className="rounded-xl border border-gray-100 p-2.5">
            <p className="mb-1.5 text-[13px] font-semibold text-gray-900">
              {u.propertyCode} <span className="font-normal text-gray-500">· {u.name}</span>
            </p>
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,7.5rem)] gap-2">
              <input
                className="input"
                list="building-names"
                aria-label={t(`${u.propertyCode} 的楼盘`, `${u.propertyCode} building`)}
                placeholder={t("楼盘，例如 Pixel City Residence", "Building, e.g. Pixel City Residence")}
                maxLength={80}
                value={rows[u.propertyCode].building}
                onChange={(e) => set(u.propertyCode, "building", e.target.value)}
              />
              <input
                className="input"
                aria-label={t(`${u.propertyCode} 的单位号码`, `${u.propertyCode} unit no.`)}
                placeholder="B-12-03"
                maxLength={40}
                value={rows[u.propertyCode].unitNo}
                onChange={(e) => set(u.propertyCode, "unitNo", e.target.value)}
              />
            </div>
          </li>
        ))}
      </ul>
      <button type="button" onClick={save} disabled={saving} className="btn-primary mt-4 flex w-full items-center justify-center gap-1.5 py-2.5">
        <IconCheck size={17} />
        {saving ? t("保存中…", "Saving…") : t("保存", "Save")}
      </button>
    </Sheet>
  );
}
