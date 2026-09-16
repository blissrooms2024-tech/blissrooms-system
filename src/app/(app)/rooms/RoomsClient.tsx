"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ROOM_STATUS_LABELS } from "@/lib/config";
import { useToast } from "@/components/Toast";
import ConfirmDialog from "@/components/ConfirmDialog";
import RoomEditModal from "./RoomEditModal";

interface Room {
  roomCode: string;
  propertyCode: string | null;
  propertyName: string;
  roomType: string | null;
  roomRental: number;
  carparkRental: number;
  carparkLotNumber: string | null;
  hasAircon: boolean;
  isCarpark: boolean;
  status: "VACANT" | "OCCUPIED" | "RESERVED" | "MAINTENANCE";
  currentTenantId: string | null;
  currentContractId: string | null;
  notes: string | null;
  photoLink: string | null;
  expiringSoonDate: string | null;
}

const STATUS_BADGE: Record<string, string> = {
  VACANT: "bg-green-50 text-green-700",
  OCCUPIED: "bg-red-50 text-red-700",
  RESERVED: "bg-yellow-50 text-yellow-800",
  MAINTENANCE: "bg-gray-100 text-gray-600",
};

export default function RoomsClient({ role }: { role: string }) {
  const toast = useToast();
  const [rooms, setRooms] = useState<Room[] | null>(null);
  const [error, setError] = useState("");
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [deletingRoom, setDeletingRoom] = useState<Room | null>(null);
  const [search, setSearch] = useState("");

  async function loadRooms() {
    setError("");
    try {
      const res = await fetch("/api/rooms");
      const data = await res.json();
      if (!data.success) {
        setError(data.message);
        return;
      }
      setRooms(data.rooms);
    } catch {
      setError("出错，请稍后再试");
    }
  }

  useEffect(() => {
    // setState happens after the fetch's await, not synchronously in the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadRooms();
  }, []);

  async function changeStatus(roomCode: string, status: string) {
    const res = await fetch(`/api/rooms/${roomCode}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (!data.success) toast.danger(data.message);
    loadRooms();
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
  const title = role === "AGENT" ? "空房 + 快到期清单 (做 Sales 用)" : "房间清单";
  const rentalOf = (r: Room) => (r.isCarpark ? r.carparkRental : r.roomRental);

  const q = search.trim().toLowerCase();
  const filteredRooms = rooms?.filter((r) => {
    if (!q) return true;
    return (
      r.roomCode.toLowerCase().includes(q) ||
      r.propertyName.toLowerCase().includes(q) ||
      (r.propertyCode ?? "").toLowerCase().includes(q) ||
      (r.roomType ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white p-5 shadow-sm">
        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2.5">
          <h3 className="text-base font-semibold text-brand">{title}</h3>
          {canEdit && (
            <Link href="/rooms/new" className="btn-primary text-sm">
              ➕ 加新房间
            </Link>
          )}
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 搜 Room Code / 楼盘名字 / 类型..."
          className="input mb-3.5 max-w-xs"
        />
        {error && <div className="text-sm text-red-600">{error}</div>}
        {!rooms && !error && <div className="text-sm text-gray-500">载入中...</div>}
        {rooms && (
          <div className="space-y-2.5 sm:hidden">
            {filteredRooms!.length === 0 && (
              <div className="py-6 text-center text-sm text-gray-400">{q ? "没有符合条件的房间" : "暂时没有房间"}</div>
            )}
            {filteredRooms!.map((r) => (
              <div key={r.roomCode} className="rounded-lg border border-gray-100 p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Link href={`/rooms/${r.roomCode}`} className="font-semibold text-brand hover:underline">
                      {r.roomCode}
                    </Link>
                    {r.isCarpark && (
                      <span className="ml-1.5 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                        🅿️ {r.carparkLotNumber || "车位"}
                      </span>
                    )}
                    <div className="text-sm text-gray-700">
                      {r.propertyCode ? (
                        <Link href={`/units/${r.propertyCode}`} className="text-brand hover:underline">
                          {r.propertyName}
                        </Link>
                      ) : (
                        <span className="text-gray-400">{r.propertyName || "未分配"}</span>
                      )}
                      {r.roomType ? ` · ${r.roomType}` : ""}
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE[r.status]}`}>
                    {ROOM_STATUS_LABELS[r.status]}
                  </span>
                </div>
                {r.expiringSoonDate && (
                  <div className="mt-1.5 text-xs font-semibold text-orange-600">
                    ⏰ 快到期: {r.expiringSoonDate.slice(0, 10)}
                  </div>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
                  <span>RM{rentalOf(r)}</span>
                  {r.hasAircon && <span>❄️ 有冷气</span>}
                  {r.photoLink && (
                    <a href={r.photoLink} target="_blank" rel="noopener noreferrer" className="text-brand underline">
                      📷 照片
                    </a>
                  )}
                </div>
                {canEdit && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    <select
                      value={r.status}
                      onChange={(e) => changeStatus(r.roomCode, e.target.value)}
                      className="rounded-md border border-gray-300 px-2 py-1.5 text-xs"
                    >
                      {Object.entries(ROOM_STATUS_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setEditingRoom(r)}
                      className="flex-1 rounded-md bg-gray-100 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-200"
                    >
                      ✏️ 编辑
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingRoom(r)}
                      className="flex-1 rounded-md bg-red-50 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
                    >
                      🗑️ 删除
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {rooms && (
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-gray-600">
                  <Th className="sticky left-0 bg-gray-50 shadow-[4px_0_4px_-4px_rgba(0,0,0,0.15)]">Room Code</Th>
                  <Th>楼盘 Unit</Th>
                  <Th>类型</Th>
                  <Th>租金</Th>
                  <Th>冷气</Th>
                  <Th>照片</Th>
                  <Th>状态</Th>
                  {canEdit && <Th>改状态</Th>}
                  {canEdit && <Th>操作</Th>}
                </tr>
              </thead>
              <tbody>
                {filteredRooms!.length === 0 && (
                  <tr>
                    <td colSpan={canEdit ? 9 : 7} className="py-6 text-center text-gray-400">
                      {q ? "没有符合条件的房间" : "暂时没有房间"}
                    </td>
                  </tr>
                )}
                {filteredRooms!.map((r) => (
                  <tr key={r.roomCode} className="border-b border-gray-100">
                    <Td className="sticky left-0 bg-white shadow-[4px_0_4px_-4px_rgba(0,0,0,0.15)]">
                      <Link href={`/rooms/${r.roomCode}`} className="font-semibold text-brand hover:underline">
                        {r.roomCode}
                      </Link>
                      {r.isCarpark && (
                        <span className="ml-1.5 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                          🅿️ {r.carparkLotNumber || "车位"}
                        </span>
                      )}
                    </Td>
                    <Td>
                      {r.propertyCode ? (
                        <Link href={`/units/${r.propertyCode}`} className="text-brand hover:underline">
                          {r.propertyName}
                        </Link>
                      ) : (
                        <span className="text-gray-400">{r.propertyName || "未分配"}</span>
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
                          {r.hasAircon ? "❄️ 有" : "- 没有"}
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
                          📷 查看
                        </a>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </Td>
                    <Td>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE[r.status]}`}>
                        {ROOM_STATUS_LABELS[r.status]}
                      </span>
                      {r.expiringSoonDate && (
                        <div className="mt-1 text-xs font-semibold text-orange-600">
                          ⏰ {r.expiringSoonDate.slice(0, 10)}
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
                          {Object.entries(ROOM_STATUS_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>
                              {v}
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
                            ✏️ 编辑
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingRoom(r)}
                            className="rounded-md bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
                          >
                            🗑️ 删除
                          </button>
                        </div>
                      </Td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editingRoom && (
        <RoomEditModal room={editingRoom} onClose={() => setEditingRoom(null)} onSaved={loadRooms} />
      )}

      <ConfirmDialog
        open={!!deletingRoom}
        danger
        title="⚠️ 删除房间"
        message={`确定要删除房间 ${deletingRoom?.roomCode} 吗？此操作不能撤销。`}
        confirmLabel="确定删除"
        onConfirm={confirmDeleteRoom}
        onCancel={() => setDeletingRoom(null)}
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
