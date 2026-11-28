"use client";
import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { groupOf } from "@/lib/receiptMatch";

export interface PickTenant {
  name: string;
  phone: string | null;
  contractCode: string;
  status: string;
}

export interface PickRoom {
  roomCode: string;
  status?: string;
  isCarpark?: boolean;
  roomType?: string | null;
  tenant?: PickTenant | null;
}

export interface PickUnit {
  propertyCode: string;
  name: string;
  /** The condo / apartment (楼盘) it's in. */
  building: string | null;
  unitNo: string | null;
  rooms?: PickRoom[];
}

export interface UnitRoomValue {
  /** 楼盘: a condo name, a unit with no condo (its own name), or COMPANY_GROUP. */
  group: string;
  unit: string;
  room: string;
}

export const EMPTY_PICK: UnitRoomValue = { group: "", unit: "", room: "" };

/** 楼盘 choice for "not any unit" (company overhead). */
export const COMPANY_GROUP = "__COMPANY__";

/** The unit number (B-12-03); the unit's name when it has none. */
export const unitLabel = (u: PickUnit) => u.unitNo ?? u.name;
/** "PXC-02" in unit PXC → "02". */
export const roomLabel = (roomCode: string, propertyCode: string) =>
  roomCode.startsWith(`${propertyCode}-`) ? roomCode.slice(propertyCode.length + 1) : roomCode;

/** The next value after choosing a 楼盘: its only unit is picked straight away. */
export function pickGroup(units: PickUnit[], group: string): UnitRoomValue {
  const inGroup = group === COMPANY_GROUP ? [] : units.filter((u) => groupOf(u) === group);
  return { group, unit: inGroup.length === 1 ? inGroup[0].propertyCode : "", room: "" };
}

/** The value that points at one unit (and optionally one of its rooms). */
export function pickOf(units: PickUnit[], propertyCode: string, roomCode = ""): UnitRoomValue {
  const u = units.find((x) => x.propertyCode === propertyCode);
  return u ? { group: groupOf(u), unit: u.propertyCode, room: roomCode } : EMPTY_PICK;
}

/** The value that points at the unit holding this room, with the room chosen. */
export function pickOfRoom(units: PickUnit[], roomCode: string): UnitRoomValue {
  const u = units.find((x) => (x.rooms ?? []).some((r) => r.roomCode === roomCode));
  return u ? { group: groupOf(u), unit: u.propertyCode, room: roomCode } : EMPTY_PICK;
}

/** Property codes a filter value covers: one unit, a whole 楼盘, or everything (null). */
export function unitsIn(units: PickUnit[], v: UnitRoomValue): Set<string> | null {
  if (v.unit) return new Set([v.unit]);
  if (!v.group) return null;
  return new Set(units.filter((u) => groupOf(u) === v.group).map((u) => u.propertyCode));
}

// One fetch per page (refreshed after a minute), shared by every picker on it.
let treeCache: Promise<PickUnit[]> | null = null;
let treeAt = 0;
const treeListeners = new Set<() => void>();

function loadTree(): Promise<PickUnit[]> {
  if (!treeCache || Date.now() - treeAt > 60_000) {
    treeAt = Date.now();
    treeCache = fetch("/api/properties/tree")
      .then((r) => r.json())
      .then((d) => (d.success ? (d.units as PickUnit[]) : []))
      .catch(() => {
        treeCache = null;
        return [];
      });
  }
  return treeCache;
}

/** After changing units (楼盘, unit numbers, rooms): every picker on the page fetches again. */
export function invalidateUnitTree() {
  treeCache = null;
  treeListeners.forEach((f) => f());
}

/** Every live unit with its 楼盘, unit number, rooms and who's in them (/api/properties/tree). */
export function useUnitTree(): PickUnit[] | null {
  const [units, setUnits] = useState<PickUnit[] | null>(null);
  useEffect(() => {
    let live = true;
    const get = () => loadTree().then((u) => live && setUnits(u));
    get();
    treeListeners.add(get);
    return () => {
      live = false;
      treeListeners.delete(get);
    };
  }, []);
  return units;
}

/**
 * 楼盘 → 单位号码 → 房间, as three dropdowns. 楼盘 is the condo; a unit not in any condo is
 * listed under its own name. Controlled: the parent keeps the value.
 *  - mode "filter": the first options read 全部楼盘 / 全部单位 (nothing chosen = everything).
 *  - roomFilter + hideEmpty: only rooms that fit (e.g. vacant ones), and no unit or 楼盘 left
 *    without one.
 */
export default function UnitRoomSelect({
  units,
  value,
  onChange,
  company = false,
  rooms = "optional",
  mode = "form",
  roomFilter,
  hideEmpty = false,
  roomText,
  bare = false,
  roomLabelText,
  invalid = false,
}: {
  units: PickUnit[];
  value: UnitRoomValue;
  onChange: (v: UnitRoomValue) => void;
  /** Offer 公司开销 (not any unit) as a 楼盘. */
  company?: boolean;
  /** optional: 整个单位 or a room · required: a room · none: no room dropdown. */
  rooms?: "optional" | "required" | "none";
  mode?: "form" | "filter";
  roomFilter?: (r: PickRoom) => boolean;
  hideEmpty?: boolean;
  /** How a room reads in its dropdown; default "02". */
  roomText?: (r: PickRoom, u: PickUnit) => string;
  /** No field labels, all in one row (a filter bar). */
  bare?: boolean;
  /** Label over the room dropdown. */
  roomLabelText?: string;
  /** Outline the next empty dropdown in red (form validation). */
  invalid?: boolean;
}) {
  const { t } = useLanguage();
  const filter = mode === "filter";

  const usable = useMemo(() => {
    if (!hideEmpty || !roomFilter) return units;
    return units.filter((u) => (u.rooms ?? []).some(roomFilter));
  }, [units, hideEmpty, roomFilter]);
  const groups = useMemo(() => [...new Set(usable.map(groupOf))].sort((a, b) => a.localeCompare(b)), [usable]);
  const inGroup = useMemo(
    () =>
      usable
        .filter((u) => groupOf(u) === value.group)
        .sort((a, b) => unitLabel(a).localeCompare(unitLabel(b), undefined, { numeric: true })),
    [usable, value.group]
  );
  const unit = usable.find((u) => u.propertyCode === value.unit);
  const roomList = (unit?.rooms ?? []).filter((r) => !roomFilter || roomFilter(r));
  const isCompany = value.group === COMPANY_GROUP;
  const red = (empty: boolean) => (invalid && empty ? " border-red-500 ring-1 ring-red-500" : "");

  const groupSelect = (
    <select
      className={`input${red(!value.group)}`}
      aria-label={t("楼盘", "Building")}
      value={value.group}
      onChange={(e) => onChange(filter ? { group: e.target.value, unit: "", room: "" } : pickGroup(usable, e.target.value))}
    >
      <option value="">{filter ? t("全部楼盘", "All buildings") : t("— 选楼盘 —", "— Choose —")}</option>
      {groups.map((g) => (
        <option key={g} value={g}>
          {g}
        </option>
      ))}
      {company && <option value={COMPANY_GROUP}>{t("公司开销（不属于任何单位）", "Company (no unit)")}</option>}
    </select>
  );
  const unitSelect = (
    <select
      className={`input${red(!!value.group && !value.unit && !filter)}`}
      aria-label={t("单位号码", "Unit no.")}
      value={value.unit}
      disabled={!value.group}
      onChange={(e) => onChange({ ...value, unit: e.target.value, room: "" })}
    >
      <option value="">{filter ? t("全部单位", "All units") : !value.group ? t("先选楼盘", "Building first") : t("— 选单位 —", "— Choose —")}</option>
      {inGroup.map((u) => (
        <option key={u.propertyCode} value={u.propertyCode}>
          {unitLabel(u)}
        </option>
      ))}
    </select>
  );
  const roomSelect = (
    <select
      className={`input${red(!!value.unit && !value.room && rooms === "required")}`}
      aria-label={t("房间", "Room")}
      value={value.room}
      disabled={!value.unit}
      onChange={(e) => onChange({ ...value, room: e.target.value })}
    >
      <option value="">
        {!value.unit
          ? t("先选单位", "Unit first")
          : rooms === "optional"
            ? t("整个单位", "Whole unit")
            : roomList.length
              ? t("— 选房间 —", "— Choose —")
              : t("没有合适的房间", "No room fits")}
      </option>
      {unit &&
        roomList.map((r) => (
          <option key={r.roomCode} value={r.roomCode}>
            {roomText ? roomText(r, unit) : roomLabel(r.roomCode, unit.propertyCode)}
          </option>
        ))}
    </select>
  );

  if (bare) {
    return (
      <div className={`grid gap-2 ${isCompany ? "grid-cols-1" : rooms === "none" ? "grid-cols-2" : "grid-cols-3"}`}>
        {groupSelect}
        {!isCompany && unitSelect}
        {!isCompany && rooms !== "none" && roomSelect}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="block">
        <span className="mb-1 block text-sm text-gray-600">{t("楼盘", "Building")}</span>
        {groupSelect}
      </label>
      {!isCompany && (
        <div className={rooms === "none" ? "" : "grid grid-cols-2 gap-2"}>
          <label className="block min-w-0">
            <span className="mb-1 block text-sm text-gray-600">{t("单位号码", "Unit no.")}</span>
            {unitSelect}
          </label>
          {rooms !== "none" && (
            <label className="block min-w-0">
              <span className="mb-1 block text-sm text-gray-600">
                {roomLabelText ?? (rooms === "optional" ? t("房间（可不选）", "Room (optional)") : t("房间", "Room"))}
              </span>
              {roomSelect}
            </label>
          )}
        </div>
      )}
    </div>
  );
}
