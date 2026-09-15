"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { ROOM_TYPE_OPTIONS } from "@/lib/config";

const isPresetType = (t: string) => (ROOM_TYPE_OPTIONS as readonly string[]).includes(t);

export interface EditableRoom {
  roomCode: string;
  roomType: string | null;
  roomRental: number;
  carparkRental: number;
  carparkLotNumber: string | null;
  hasAircon: boolean;
  isCarpark: boolean;
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
  const [roomCode, setRoomCode] = useState(room.roomCode);
  const [roomType, setRoomType] = useState(room.roomType && isPresetType(room.roomType) ? room.roomType : "");
  const [customType, setCustomType] = useState(room.roomType && !isPresetType(room.roomType) ? room.roomType : "");
  const [useCustomType, setUseCustomType] = useState(!!room.roomType && !isPresetType(room.roomType));
  const [roomRental, setRoomRental] = useState(String(room.roomRental));
  const [carparkRental, setCarparkRental] = useState(String(room.carparkRental));
  const [carparkLotNumber, setCarparkLotNumber] = useState(room.carparkLotNumber ?? "");
  const [hasAircon, setHasAircon] = useState(room.hasAircon);
  const [isCarpark, setIsCarpark] = useState(room.isCarpark);
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
          roomCode,
          roomType: useCustomType ? customType : roomType,
          roomRental: Number(roomRental) || 0,
          carparkRental: Number(carparkRental) || 0,
          carparkLotNumber,
          hasAircon,
          isCarpark,
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
          <label className="mb-1.5 block text-sm text-gray-600">Room Code</label>
          <input
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            className="input uppercase"
          />
          <p className="mt-1 text-xs text-gray-400">改了 code 要确保没有跟别的房间/车位重复</p>
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-gray-600">类型</label>
          <select
            value={useCustomType ? "__custom__" : roomType}
            onChange={(e) => {
              if (e.target.value === "__custom__") {
                setUseCustomType(true);
              } else {
                setUseCustomType(false);
                setRoomType(e.target.value);
              }
            }}
            className="input"
          >
            <option value="">-- 选类型 --</option>
            {ROOM_TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
            <option value="__custom__">其他 (自己填)</option>
          </select>
          {useCustomType && (
            <input
              value={customType}
              onChange={(e) => setCustomType(e.target.value)}
              className="input mt-2"
              placeholder="自己填类型"
            />
          )}
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
        <label className="flex cursor-pointer items-center gap-1.5 text-sm text-gray-600">
          <input type="checkbox" checked={isCarpark} onChange={(e) => setIsCarpark(e.target.checked)} />
          🅿️ 这是车位专用 (不是房间，只租车位)
        </label>
        {isCarpark && (
          <div>
            <label className="mb-1.5 block text-sm text-gray-600">车位编号 Carpark Lot</label>
            <input
              value={carparkLotNumber}
              onChange={(e) => setCarparkLotNumber(e.target.value)}
              className="input"
              placeholder="例: B-123"
            />
            <p className="mt-1 text-xs text-gray-400">建筑物本身画的车位号码 (跟系统内部的 Room Code 可以不一样)</p>
          </div>
        )}
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
