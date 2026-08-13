"use client";

import { useEffect, useState, FormEvent } from "react";
import { ROOM_STATUS_LABELS } from "@/lib/config";
import { useToast } from "@/components/Toast";

interface Room {
  roomCode: string;
  propertyName: string;
  roomType: string | null;
  roomRental: number;
  carparkRental: number;
  status: "VACANT" | "OCCUPIED" | "RESERVED" | "MAINTENANCE";
  currentTenantId: string | null;
  currentContractId: string | null;
  notes: string | null;
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
  const [form, setForm] = useState({ roomCode: "", propertyName: "", roomType: "", roomRental: "" });

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

  async function addRoom(e: FormEvent) {
    e.preventDefault();
    if (!form.roomCode) {
      toast.warning("Room Code 不能空");
      return;
    }
    const res = await fetch("/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (data.success) {
      toast.success(data.message);
      setForm({ roomCode: "", propertyName: "", roomType: "", roomRental: "" });
      loadRooms();
    } else {
      toast.danger(data.message);
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
  }

  const canEdit = role === "ADMIN";
  const title = role === "AGENT" ? "空房清单 (做 Sales 用)" : "房间清单";

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <h3 className="mb-3.5 text-base font-semibold text-brand">➕ 加新房间</h3>
          <form onSubmit={addRoom} className="flex flex-wrap items-end gap-2.5">
            <Field label="Room Code">
              <input
                value={form.roomCode}
                onChange={(e) => setForm({ ...form, roomCode: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="物业">
              <input
                value={form.propertyName}
                onChange={(e) => setForm({ ...form, propertyName: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="类型">
              <input
                value={form.roomType}
                onChange={(e) => setForm({ ...form, roomType: e.target.value })}
                placeholder="Master/Single"
                className="input"
              />
            </Field>
            <Field label="房租 RM">
              <input
                type="number"
                value={form.roomRental}
                onChange={(e) => setForm({ ...form, roomRental: e.target.value })}
                className="input"
              />
            </Field>
            <button type="submit" className="btn-primary">
              加入
            </button>
          </form>
        </div>
      )}

      <div className="rounded-xl bg-white p-5 shadow-sm">
        <h3 className="mb-3.5 text-base font-semibold text-brand">{title}</h3>
        {error && <div className="text-sm text-red-600">{error}</div>}
        {!rooms && !error && <div className="text-sm text-gray-500">载入中...</div>}
        {rooms && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-gray-600">
                  <Th>Room Code</Th>
                  <Th>物业</Th>
                  <Th>类型</Th>
                  <Th>房租</Th>
                  <Th>状态</Th>
                  {canEdit && <Th>改状态</Th>}
                </tr>
              </thead>
              <tbody>
                {rooms.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-gray-400">
                      暂时没有房间
                    </td>
                  </tr>
                )}
                {rooms.map((r) => (
                  <tr key={r.roomCode} className="border-b border-gray-100">
                    <Td>
                      <b>{r.roomCode}</b>
                    </Td>
                    <Td>{r.propertyName}</Td>
                    <Td>{r.roomType}</Td>
                    <Td>RM{r.roomRental}</Td>
                    <Td>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE[r.status]}`}>
                        {ROOM_STATUS_LABELS[r.status]}
                      </span>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-[130px] flex-1">
      <label className="mb-1.5 block text-sm text-gray-600">{label}</label>
      {children}
    </div>
  );
}
function Th({ children }: { children: React.ReactNode }) {
  return <th className="whitespace-nowrap px-2.5 py-2 font-semibold">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="whitespace-nowrap px-2.5 py-2.5">{children}</td>;
}
