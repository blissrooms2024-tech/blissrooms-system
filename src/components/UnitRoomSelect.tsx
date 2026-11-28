"use client";
import { useMemo } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { groupOf } from "@/lib/receiptMatch";

export interface PickUnit {
  propertyCode: string;
  name: string;
  /** The condo / apartment (楼盘) it's in. */
  building: string | null;
  unitNo: string | null;
  rooms?: { roomCode: string }[];
}

export interface UnitRoomValue {
  /** 楼盘: a condo name, a unit with no condo (its own name), or COMPANY. */
  group: string;
  unit: string;
  room: string;
}

/** 楼盘 choice for "not any unit" (company overhead). */
export const COMPANY_GROUP = "__COMPANY__";

/** The unit number (B-12-03); the unit's name when it has none. */
export const unitLabel = (u: PickUnit) => u.unitNo ?? u.name;
/** "PXC-02" in unit PXC → "02". */
export const roomLabel = (roomCode: string, propertyCode: string) =>
  roomCode.startsWith(`${propertyCode}-`) ? roomCode.slice(propertyCode.length + 1) : roomCode;

/** Pick a 楼盘 and the unit: the next value after choosing a 楼盘 (its only unit, if it has one). */
export function pickGroup(units: PickUnit[], group: string): UnitRoomValue {
  const inGroup = group === COMPANY_GROUP ? [] : units.filter((u) => groupOf(u) === group);
  return { group, unit: inGroup.length === 1 ? inGroup[0].propertyCode : "", room: "" };
}

/**
 * 楼盘 → 单位号码 → 房间, as three dropdowns. 楼盘 is the condo; a unit not in any condo is
 * listed under its own name. Controlled: the parent keeps the value.
 */
export default function UnitRoomSelect({
  units,
  value,
  onChange,
  company = false,
  rooms = "optional",
}: {
  units: PickUnit[];
  value: UnitRoomValue;
  onChange: (v: UnitRoomValue) => void;
  /** Offer 公司开销 (not any unit) as a 楼盘. */
  company?: boolean;
  /** optional: 整个单位 or a room · required: a room · none: no room dropdown. */
  rooms?: "optional" | "required" | "none";
}) {
  const { t } = useLanguage();
  const groups = useMemo(() => [...new Set(units.map(groupOf))].sort((a, b) => a.localeCompare(b)), [units]);
  const inGroup = useMemo(
    () =>
      units
        .filter((u) => groupOf(u) === value.group)
        .sort((a, b) => (a.unitNo ?? a.propertyCode).localeCompare(b.unitNo ?? b.propertyCode, undefined, { numeric: true })),
    [units, value.group]
  );
  const roomList = units.find((u) => u.propertyCode === value.unit)?.rooms ?? [];
  const isCompany = value.group === COMPANY_GROUP;

  return (
    <div className="space-y-2">
      <label className="block">
        <span className="mb-1 block text-sm text-gray-600">{t("楼盘", "Building")}</span>
        <select className="input" value={value.group} onChange={(e) => onChange(pickGroup(units, e.target.value))}>
          <option value="">{t("— 选楼盘 —", "— Choose —")}</option>
          {groups.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
          {company && <option value={COMPANY_GROUP}>{t("公司开销（不属于任何单位）", "Company (no unit)")}</option>}
        </select>
      </label>

      {!isCompany && (
        <div className={rooms === "none" ? "" : "grid grid-cols-2 gap-2"}>
          <label className="block min-w-0">
            <span className="mb-1 block text-sm text-gray-600">{t("单位号码", "Unit no.")}</span>
            <select
              className="input"
              value={value.unit}
              disabled={!value.group}
              onChange={(e) => onChange({ ...value, unit: e.target.value, room: "" })}
            >
              <option value="">{value.group ? t("— 选单位 —", "— Choose —") : t("先选楼盘", "Building first")}</option>
              {inGroup.map((u) => (
                <option key={u.propertyCode} value={u.propertyCode}>
                  {unitLabel(u)}
                </option>
              ))}
            </select>
          </label>
          {rooms !== "none" && (
            <label className="block min-w-0">
              <span className="mb-1 block text-sm text-gray-600">{rooms === "optional" ? t("房间（可不选）", "Room (optional)") : t("房间", "Room")}</span>
              <select
                className="input"
                value={value.room}
                disabled={!value.unit}
                onChange={(e) => onChange({ ...value, room: e.target.value })}
              >
                <option value="">
                  {!value.unit ? t("先选单位", "Unit first") : rooms === "optional" ? t("整个单位", "Whole unit") : t("— 选房间 —", "— Choose —")}
                </option>
                {roomList.map((r) => (
                  <option key={r.roomCode} value={r.roomCode}>
                    {roomLabel(r.roomCode, value.unit)}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}
    </div>
  );
}
