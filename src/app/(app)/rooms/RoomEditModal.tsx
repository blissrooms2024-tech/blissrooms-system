"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import { useToast } from "@/components/Toast";

export interface EditableRoom {
  roomCode: string;
  roomType: string | null;
  roomRental: number;
  carparkRental: number;
  hasAircon: boolean;
  notes: string | null;
  photoLink: string | null;
}

export default function RoomEditModal({
  room,
  onClose,
  onSaved,
}: {
  room: EditableRoom;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [roomType, setRoomType] = useState(room.roomType ?? "");
  const [roomRental, setRoomRental] = useState(String(room.roomRental));
  const [carparkRental, setCarparkRental] = useState(String(room.carparkRental));
  const [hasAircon, setHasAircon] = useState(room.hasAircon);
  const [notes, setNotes] = useState(room.notes ?? "");
  const [photoLink, setPhotoLink] = useState(room.photoLink ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/rooms/${room.roomCode}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomType,
          roomRental: Number(roomRental) || 0,
          carparkRental: Number(carparkRental) || 0,
          hasAircon,
          notes,
          photoLink,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        onSaved();
        onClose();
      } else {
        toast.danger(data.message);
      }
    } catch {
      toast.danger("系统出错，请稍后再试");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <h3 className="mb-3.5 text-lg font-bold text-brand">✏️ 编辑房间 — {room.roomCode}</h3>
      <div className="space-y-3">
        <div>
          <label className="mb-1.5 block text-sm text-gray-600">类型</label>
          <input value={roomType} onChange={(e) => setRoomType(e.target.value)} className="input" placeholder="Master/Single" />
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="mb-1.5 block text-sm text-gray-600">房租 RM</label>
            <input
              type="number"
              value={roomRental}
              onChange={(e) => setRoomRental(e.target.value)}
              className="input"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1.5 block text-sm text-gray-600">车位租金 RM</label>
            <input
              type="number"
              value={carparkRental}
              onChange={(e) => setCarparkRental(e.target.value)}
              className="input"
            />
          </div>
        </div>
        <label className="flex cursor-pointer items-center gap-1.5 text-sm text-gray-600">
          <input type="checkbox" checked={hasAircon} onChange={(e) => setHasAircon(e.target.checked)} />
          ❄️ 有冷气
        </label>
        <div>
          <label className="mb-1.5 block text-sm text-gray-600">📷 房间照片 (Google Drive 链接)</label>
          <input
            value={photoLink}
            onChange={(e) => setPhotoLink(e.target.value)}
            className="input"
            placeholder="https://drive.google.com/..."
          />
          <p className="mt-1 text-xs text-gray-400">贴一个 Drive 文件夹/相册链接，Agent 就能直接看房间照片</p>
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-gray-600">备注 Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="input" />
        </div>
        <button onClick={save} disabled={saving} className="btn-primary w-full">
          {saving ? "保存中..." : "保存"}
        </button>
      </div>
    </Modal>
  );
}
