"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ROOM_STATUS_LABELS, ROOM_STATUS_BADGE, roomStatusLabel } from "@/lib/config";
import { fmtDate } from "@/lib/format";
import { useToast } from "@/components/Toast";
import ConfirmDialog from "@/components/ConfirmDialog";
import Sheet from "@/components/Sheet";
import { useLanguage } from "@/components/LanguageProvider";
import { IconBed, IconBuilding, IconCamera, IconCheck, IconChevronRight, IconDots, IconPen, IconPlus, IconRefresh, IconSearch, IconTrash, IconX } from "@/components/icons";
import RoomEditModal from "./RoomEditModal";

interface Room {
  roomCode: string;
  propertyCode: string | null;
  propertyName: string;
  roomType: string | null;
  roomRental: number;
  carparkRental: number;
  securityDeposit: number;
  carparkLotNumber: string | null;
  hasAircon: boolean;
  isCarpark: boolean;
  status: "VACANT" | "OCCUPIED" | "RESERVED" | "MAINTENANCE" | "STORE";
  currentTenantId: string | null;
  currentContractId: string | null;
  notes: string | null;
  photoLink: string | null;
  expiringSoonDate: string | null;
}

/** The room list. On a unit's page (`propertyCode`, `embedded`) it shows only that unit's rooms,
 * without the page title and buttons. */
export default function RoomsClient({ role, propertyCode, embedded = false }: { role: string; propertyCode?: string; embedded?: boolean }) {
  const toast = useToast();
  const { locale, t } = useLanguage();
  const [rooms, setRooms] = useState<Room[] | null>(null);
  const [error, setError] = useState("");
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [deletingRoom, setDeletingRoom] = useState<Room | null>(null);
  /** The room whose status / actions sheet is open (phones). */
  const [menuRoom, setMenuRoom] = useState<Room | null>(null);
  const [savingStatus, setSavingStatus] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [airconFilter, setAirconFilter] = useState("");
  const [confirmingVacate, setConfirmingVacate] = useState(false);
  const [vacating, setVacating] = useState(false);

  async function loadRooms() {
    setError("");
    try {
      const res = await fetch("/api/rooms");
      const data = await res.json();
      if (!data.success) {
        setError(data.message);
        return;
      }
      setRooms(propertyCode ? data.rooms.filter((r: Room) => r.propertyCode === propertyCode) : data.rooms);
    } catch {
      setError(t("出错，请稍后再试", "Something went wrong — please try again later"));
    }
  }

  useEffect(() => {
    // setState happens after the fetch's await, not synchronously in the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadRooms();
  }, []);

  async function runVacateExpired() {
    setConfirmingVacate(false);
    setVacating(true);
    try {
      const res = await fetch("/api/rooms/vacate-expired", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        loadRooms();
      } else {
        toast.danger(data.message);
      }
    } catch {
      toast.danger(t("系统出错，请稍后再试", "System error — please try again later"));
    } finally {
      setVacating(false);
    }
  }

  async function changeStatus(roomCode: string, status: string) {
    const res = await fetch(`/api/rooms/${roomCode}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (!data.success) toast.danger(data.message);
    loadRooms();
    return !!data.success;
  }

  /** From the phone sheet: change, say so, close. */
  async function pickStatus(r: Room, status: string) {
    setSavingStatus(true);
    try {
      if (await changeStatus(r.roomCode, status)) {
        const l = roomStatusLabel(status, locale);
        toast.success(t(`${r.roomCode} 改成「${l}」`, `${r.roomCode} is now ${l}`));
        setMenuRoom(null);
      }
    } catch {
      toast.danger(t("系统出错，请稍后再试", "System error — please try again later"));
    } finally {
      setSavingStatus(false);
    }
  }

  async function toggleAircon(roomCode: string, hasAircon: boolean) {
    const res = await fetch(`/api/rooms/${roomCode}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hasAircon }),
    });
    const data = await res.json();
    if (!data.success) toast.danger(data.message);
    loadRooms();
  }

  async function confirmDeleteRoom() {
    if (!deletingRoom) return;
    const res = await fetch(`/api/rooms/${deletingRoom.roomCode}`, { method: "DELETE" });
    const data = await res.json();
    if (data.success) {
      toast.success(data.message);
      loadRooms();
    } else {
      toast.danger(data.message);
    }
    setDeletingRoom(null);
  }

  const canEdit = role === "ADMIN";
  const rentalOf = (r: Room) => (r.isCarpark ? r.carparkRental : r.roomRental);

  // Search, status and aircon combine; each chip counts what it would show with the other
  // filters as they are, so a number never promises rooms the list then hides.
  const q = search.trim().toLowerCase();
  const matchesQ = (r: Room) =>
    !q ||
    r.roomCode.toLowerCase().includes(q) ||
    r.propertyName.toLowerCase().includes(q) ||
    (r.propertyCode ?? "").toLowerCase().includes(q) ||
    (r.roomType ?? "").toLowerCase().includes(q);
  const matchesStatus = (r: Room) => !statusFilter || r.status === statusFilter;
  const matchesAir = (r: Room) => !airconFilter || (airconFilter === "YES" ? r.hasAircon : !r.hasAircon);
  const filteredRooms = rooms?.filter((r) => matchesQ(r) && matchesStatus(r) && matchesAir(r));
  const statusCounts: Record<string, number> = {};
  for (const r of rooms ?? []) if (matchesQ(r) && matchesAir(r)) statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1;
  const airBase = (rooms ?? []).filter((r) => matchesQ(r) && matchesStatus(r));
  const airYes = airBase.filter((r) => r.hasAircon).length;
  const airNo = airBase.length - airYes;
  const allCount = (rooms ?? []).filter(matchesQ).length;
  const filtered = !!(q || statusFilter || airconFilter);

  const chip = (on: boolean) =>
    `flex h-8 shrink-0 items-center gap-1 rounded-full px-3 text-[13px] font-medium transition-colors ${
      on ? "bg-brand text-white" : "bg-white text-gray-700 shadow-sm hover:bg-gray-50"
    }`;
  const chipCount = (on: boolean, n: number) => <span className={`text-[11px] ${on ? "text-white/80" : "text-gray-400"}`}>{n}</span>;

  return (
    <div className="app-type mx-auto max-w-6xl space-y-3">
      {!embedded && (
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-gray-900">
            {t("房间", "Rooms")}
            {rooms && <span className="ml-1.5 text-sm font-normal text-gray-400">{rooms.length}</span>}
          </h1>
          {role === "AGENT" && <p className="text-xs text-gray-500">{t("空房 + 快到期 · 做 Sales 用", "Vacant + ending soon · for sales")}</p>}
        </div>
        {canEdit && (
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setConfirmingVacate(true)}
              disabled={vacating}
              aria-label={t("立即检查过期合同", "Check expired contracts now")}
              title={t(
                "把所有已经过期的生效合同对应的房间改回空房 (合同本身不受影响)",
                "Flip any room back to vacant whose ACTIVE contract has already expired (the contract itself is unaffected)"
              )}
              className="flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-xl bg-white px-2.5 text-[13px] text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
            >
              <IconRefresh size={17} className={vacating ? "animate-spin motion-reduce:animate-none" : ""} />
              <span className="hidden md:inline">{vacating ? t("处理中...", "Processing...") : t("立即检查过期合同", "Check expired contracts now")}</span>
            </button>
            <Link href="/rooms/new" className="flex h-9 items-center gap-1 rounded-xl bg-brand px-3 text-[13px] font-semibold text-white hover:bg-brand-dark">
              <IconPlus size={16} />
              {t("新房间", "New")}
            </Link>
          </div>
        )}
      </div>
      )}

      {/* A unit has a handful of rooms: no need to search them. */}
      {!embedded && (
      <div className="relative md:max-w-md">
        <IconSearch size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("搜房号 / 楼盘 / 房型", "Room, property, room type")}
          className="h-10 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-10 text-base shadow-sm placeholder:text-gray-400 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10 sm:text-sm"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            aria-label={t("清除搜索", "Clear search")}
            className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-gray-400 hover:bg-gray-100"
          >
            <IconX size={16} />
          </button>
        )}
      </div>
      )}

      {rooms && (
        <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] sm:-mx-5 sm:px-5 md:mx-0 md:flex-wrap md:px-0">
          <button type="button" aria-pressed={!statusFilter && !airconFilter} onClick={() => { setStatusFilter(""); setAirconFilter(""); }} className={chip(!statusFilter && !airconFilter)}>
            {t("全部", "All")}
            {chipCount(!statusFilter && !airconFilter, allCount)}
          </button>
          {Object.keys(ROOM_STATUS_LABELS)
            .filter((k) => k === statusFilter || (statusCounts[k] ?? 0) > 0)
            .map((k) => {
              const on = statusFilter === k;
              return (
                <button key={k} type="button" aria-pressed={on} onClick={() => setStatusFilter(on ? "" : k)} className={chip(on)}>
                  {roomStatusLabel(k, locale)}
                  {chipCount(on, statusCounts[k] ?? 0)}
                </button>
              );
            })}
          {((airYes > 0 && airNo > 0) || airconFilter) && (
            <>
              <span aria-hidden="true" className="my-1.5 w-px shrink-0 bg-gray-200" />
              {(["YES", "NO"] as const).map((k) => {
                const on = airconFilter === k;
                return (
                  <button key={k} type="button" aria-pressed={on} onClick={() => setAirconFilter(on ? "" : k)} className={chip(on)}>
                    {k === "YES" ? t("❄️ 有冷气", "❄️ Aircon") : t("没冷气", "No aircon")}
                    {chipCount(on, k === "YES" ? airYes : airNo)}
                  </button>
                );
              })}
            </>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <span>{error}</span>
          <button type="button" onClick={loadRooms} className="shrink-0 font-semibold underline">
            {t("再试一次", "Try again")}
          </button>
        </div>
      )}
      {!rooms && !error && (
        <ul className="space-y-2" aria-label={t("载入中", "Loading")}>
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="h-16 animate-pulse rounded-2xl bg-white/80 motion-reduce:animate-none" />
          ))}
        </ul>
      )}

      {rooms && filteredRooms && (
        <>
          {filtered && (
            <p className="px-1 text-xs text-gray-500">
              {t(`显示 ${filteredRooms.length} 间（共 ${rooms.length} 间）`, `${filteredRooms.length} of ${rooms.length} shown`)}
            </p>
          )}

          {/* Phones: two short lines per room so a screen holds about ten. */}
          <div className="md:hidden">
            {filteredRooms.length === 0 ? (
              <p className="rounded-[20px] bg-white px-4 py-8 text-center text-sm text-gray-400">
                {filtered ? t("没有符合条件的房间", "No rooms match") : t("暂时没有房间", "No rooms yet")}
              </p>
            ) : (
              <ul className="space-y-2">
                {filteredRooms.map((r) => (
                  <li key={r.roomCode} className="flex items-center gap-2 rounded-2xl bg-white py-2 pl-3 pr-1.5 shadow-[0_1px_2px_rgba(30,27,46,0.05)]">
                    <Link href={`/rooms/${r.roomCode}`} className="min-w-0 flex-1">
                      <p className="flex min-w-0 items-baseline gap-1.5">
                        <b className="shrink-0 text-[15px] font-semibold text-gray-900">{r.roomCode}</b>
                        <span className="truncate text-[13px] text-gray-700">
                          {r.isCarpark ? `🅿️ ${r.carparkLotNumber || t("车位", "Carpark")}` : r.roomType}
                        </span>
                      </p>
                      {/* Rent first: on a narrow screen the property name is what gets cut. */}
                      <p className="mt-0.5 truncate text-[11.5px] text-gray-400">
                        <span className="font-medium tabular-nums text-gray-600">RM{rentalOf(r)}</span>
                        {r.hasAircon && <> · ❄️</>} · {r.propertyName || t("未分配楼盘", "No property")}
                        {r.photoLink && <> · 📷</>}
                      </p>
                      {r.expiringSoonDate && (
                        <p className="mt-0.5 text-[11.5px] font-medium text-amber-700">
                          ⏰ {t("快到期", "Ending")} {fmtDate(r.expiringSoonDate)}
                        </p>
                      )}
                    </Link>
                    {canEdit ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setMenuRoom(r)}
                          aria-label={t(`${r.roomCode} 改状态`, `Change ${r.roomCode} status`)}
                          className="flex shrink-0 items-center py-1.5"
                        >
                          <span className={`flex items-center gap-0.5 whitespace-nowrap rounded-full py-0.5 pl-2 pr-1.5 text-[11px] font-medium ${ROOM_STATUS_BADGE[r.status]}`}>
                            {roomStatusLabel(r.status, locale)}
                            <IconChevronRight size={12} className="rotate-90" />
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setMenuRoom(r)}
                          aria-label={t(`${r.roomCode} 更多操作`, `More for ${r.roomCode}`)}
                          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-gray-500 hover:bg-gray-100"
                        >
                          <IconDots size={18} />
                        </button>
                      </>
                    ) : (
                      <span className={`mr-1.5 shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${ROOM_STATUS_BADGE[r.status]}`}>
                        {roomStatusLabel(r.status, locale)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="hidden rounded-[20px] bg-white p-4 shadow-sm md:block">
            <div className="max-h-[65vh] overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  {/* sticky top-0 keeps the header (and the horizontal scrollbar, which sits right
                      under this bounded box instead of under however many rows there are) always
                      reachable without scrolling the whole page down first. */}
                  <tr className="bg-gray-50 text-left text-gray-600">
                    <Th className="sticky left-0 top-0 z-20 bg-gray-50 shadow-[4px_0_4px_-4px_rgba(0,0,0,0.15)]">Room Code</Th>
                    <Th className="sticky top-0 z-10 bg-gray-50">{t("楼盘 Unit", "Property")}</Th>
                    <Th className="sticky top-0 z-10 bg-gray-50">{t("类型", "Type")}</Th>
                    <Th className="sticky top-0 z-10 bg-gray-50">{t("租金", "Rental")}</Th>
                    <Th className="sticky top-0 z-10 bg-gray-50">{t("冷气", "Aircon")}</Th>
                    <Th className="sticky top-0 z-10 bg-gray-50">{t("照片", "Photo")}</Th>
                    <Th className="sticky top-0 z-10 bg-gray-50">{t("状态", "Status")}</Th>
                    {canEdit && <Th className="sticky top-0 z-10 bg-gray-50">{t("改状态", "Change Status")}</Th>}
                    {canEdit && <Th className="sticky top-0 z-10 bg-gray-50">{t("操作", "Actions")}</Th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredRooms.length === 0 && (
                    <tr>
                      <td colSpan={canEdit ? 9 : 7} className="py-6 text-center text-gray-400">
                        {filtered ? t("没有符合条件的房间", "No rooms match") : t("暂时没有房间", "No rooms yet")}
                      </td>
                    </tr>
                  )}
                  {filteredRooms.map((r) => (
                    <tr key={r.roomCode} className="border-b border-gray-100">
                      <Td className="sticky left-0 bg-white shadow-[4px_0_4px_-4px_rgba(0,0,0,0.15)]">
                        <Link href={`/rooms/${r.roomCode}`} className="font-semibold text-brand hover:underline">
                          {r.roomCode}
                        </Link>
                        {r.isCarpark && (
                          <span className="ml-1.5 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                            🅿️ {r.carparkLotNumber || t("车位", "Carpark")}
                          </span>
                        )}
                      </Td>
                      <Td>
                        {r.propertyCode ? (
                          <Link href={`/units/${r.propertyCode}`} className="text-brand hover:underline">
                            {r.propertyName}
                          </Link>
                        ) : (
                          <span className="text-gray-400">{r.propertyName || t("未分配", "Unassigned")}</span>
                        )}
                      </Td>
                      <Td>{r.roomType}</Td>
                      <Td>RM{rentalOf(r)}</Td>
                      <Td>
                        {canEdit ? (
                          <button
                            type="button"
                            onClick={() => toggleAircon(r.roomCode, !r.hasAircon)}
                            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              r.hasAircon ? "bg-sky-50 text-sky-700" : "bg-gray-100 text-gray-500"
                            }`}
                          >
                            {r.hasAircon ? `❄️ ${t("有", "Yes")}` : `- ${t("没有", "No")}`}
                          </button>
                        ) : r.hasAircon ? (
                          "❄️"
                        ) : (
                          "-"
                        )}
                      </Td>
                      <Td>
                        {r.photoLink ? (
                          <a
                            href={r.photoLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-brand underline"
                          >
                            📷 {t("查看", "View")}
                          </a>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </Td>
                      <Td>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${ROOM_STATUS_BADGE[r.status]}`}>
                          {roomStatusLabel(r.status, locale) ?? r.status}
                        </span>
                        {r.expiringSoonDate && (
                          <div className="mt-1 text-xs font-semibold text-orange-600">
                            ⏰ {fmtDate(r.expiringSoonDate)}
                          </div>
                        )}
                      </Td>
                      {canEdit && (
                        <Td>
                          <select
                            value={r.status}
                            onChange={(e) => changeStatus(r.roomCode, e.target.value)}
                            className="rounded-md border border-gray-300 px-2 py-1 text-xs"
                          >
                            {Object.keys(ROOM_STATUS_LABELS).map((k) => (
                              <option key={k} value={k}>
                                {roomStatusLabel(k, locale)}
                              </option>
                            ))}
                          </select>
                        </Td>
                      )}
                      {canEdit && (
                        <Td>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setEditingRoom(r)}
                              className="rounded-md bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-200"
                            >
                              ✏️ {t("编辑", "Edit")}
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingRoom(r)}
                              className="rounded-md bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
                            >
                              🗑️ {t("删除", "Delete")}
                            </button>
                          </div>
                        </Td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <Sheet
        open={!!menuRoom}
        onClose={() => !savingStatus && setMenuRoom(null)}
        title={menuRoom ? `${menuRoom.roomCode}${menuRoom.roomType ? ` · ${menuRoom.roomType}` : ""}` : ""}
      >
        {menuRoom && (
          <>
            <p className="text-xs font-medium text-gray-500">{t("改状态", "Change status")}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {Object.keys(ROOM_STATUS_LABELS).map((k) => {
                const on = menuRoom.status === k;
                return (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={on}
                    disabled={on || savingStatus}
                    onClick={() => pickStatus(menuRoom, k)}
                    className={`flex h-9 items-center gap-1 rounded-full px-3.5 text-[13px] font-medium disabled:cursor-default ${
                      on ? ROOM_STATUS_BADGE[k] : "bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50"
                    }`}
                  >
                    {on && <IconCheck size={15} />}
                    {roomStatusLabel(k, locale)}
                  </button>
                );
              })}
            </div>
            <ul className="-mx-2 mt-3 border-t border-gray-100 pt-2">
              {[
                { key: "open", icon: IconBed, l: t("打开房间", "Open room"), href: `/rooms/${menuRoom.roomCode}` },
                { key: "edit", icon: IconPen, l: t("编辑房间", "Edit room"), run: () => setEditingRoom(menuRoom) },
                ...(menuRoom.photoLink ? [{ key: "photo", icon: IconCamera, l: t("看照片", "View photo"), href: menuRoom.photoLink, external: true }] : []),
                ...(menuRoom.propertyCode
                  ? [{ key: "unit", icon: IconBuilding, l: `${t("楼盘", "Property")} · ${menuRoom.propertyName}`, href: `/units/${menuRoom.propertyCode}` }]
                  : []),
                { key: "delete", icon: IconTrash, l: t("删除房间", "Delete room"), run: () => setDeletingRoom(menuRoom), danger: true },
              ].map((i) => {
                const body = (
                  <>
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${i.danger ? "bg-rose-50 text-rose-600" : "bg-gray-100 text-gray-600"}`}>
                      <i.icon size={18} />
                    </span>
                    <span className={`min-w-0 flex-1 truncate text-sm ${i.danger ? "text-rose-600" : "text-gray-800"}`}>{i.l}</span>
                    <IconChevronRight size={16} className="shrink-0 text-gray-300" />
                  </>
                );
                const cls = "flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left hover:bg-gray-50";
                return (
                  <li key={i.key}>
                    {i.href && i.external ? (
                      <a href={i.href} target="_blank" rel="noopener noreferrer" onClick={() => setMenuRoom(null)} className={cls}>
                        {body}
                      </a>
                    ) : i.href ? (
                      <Link href={i.href} onClick={() => setMenuRoom(null)} className={cls}>
                        {body}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setMenuRoom(null);
                          i.run?.();
                        }}
                        className={cls}
                      >
                        {body}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Sheet>

      {editingRoom && (
        <RoomEditModal room={editingRoom} onClose={() => setEditingRoom(null)} onSaved={loadRooms} />
      )}

      <ConfirmDialog
        open={!!deletingRoom}
        danger
        title={`⚠️ ${t("删除房间", "Delete Room")}`}
        message={t(
          `确定要删除房间 ${deletingRoom?.roomCode} 吗？此操作不能撤销。`,
          `Are you sure you want to delete room ${deletingRoom?.roomCode}? This action cannot be undone.`
        )}
        confirmLabel={t("确定删除", "Confirm Delete")}
        onConfirm={confirmDeleteRoom}
        onCancel={() => setDeletingRoom(null)}
      />

      <ConfirmDialog
        open={confirmingVacate}
        message={t(
          "现在执行？这会把所有生效中、但到期日已经过了的合同，对应的房间改回空房 (清空租客资料)。合同本身保持生效中，不受影响，续约的话房间会自动改回已出租。已经每天自动跑一次，这个按钮是手动立即执行。",
          "Run this now? This flips any room back to vacant (clearing the tenant) whose ACTIVE contract's expiry date has already passed. The contract itself stays ACTIVE and is unaffected — renewing it automatically re-occupies the room. This already runs automatically once a day — this button runs it immediately instead."
        )}
        confirmLabel={t("确定执行", "Confirm Run")}
        onConfirm={runVacateExpired}
        onCancel={() => setConfirmingVacate(false)}
      />
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`whitespace-nowrap px-2.5 py-2 font-semibold ${className}`}>{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`whitespace-nowrap px-2.5 py-2.5 ${className}`}>{children}</td>;
}
