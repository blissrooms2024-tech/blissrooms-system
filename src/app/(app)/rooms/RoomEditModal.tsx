"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { useT } from "@/components/LanguageProvider";
import { ROOM_TYPE_OPTIONS } from "@/lib/config";

const isPresetType = (t: string) => (ROOM_TYPE_OPTIONS as readonly string[]).includes(t);

export interface EditableRoom {
  roomCode: string;
  roomType: string | null;
  roomRental: number;
  carparkRental: number;
  securityDeposit: number;
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
  const t = useT();
  const [roomCode, setRoomCode] = useState(room.roomCode);
  const [roomType, setRoomType] = useState(room.roomType && isPresetType(room.roomType) ? room.roomType : "");
  const [customType, setCustomType] = useState(room.roomType && !isPresetType(room.roomType) ? room.roomType : "");
  const [useCustomType, setUseCustomType] = useState(!!room.roomType && !isPresetType(room.roomType));
  const [roomRental, setRoomRental] = useState(String(room.roomRental));
  const [carparkRental, setCarparkRental] = useState(String(room.carparkRental));
  const [securityDeposit, setSecurityDeposit] = useState(String(room.securityDeposit));
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
          securityDeposit: Number(securityDeposit) || 0,
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
      toast.danger(t("系统出错，请稍后再试", "System error — please try again later"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <h3 className="mb-3.5 text-lg font-bold text-brand">
        ✏️ {t("编辑房间", "Edit Room")} — {room.roomCode}
      </h3>
      <div className="space-y-3">
        <div>
          <label className="mb-1.5 block text-sm text-gray-600">Room Code</label>
          <input
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            className="input uppercase"
          />
          <p className="mt-1 text-xs text-gray-400">
            {t("改了 code 要确保没有跟别的房间/车位重复", "If you change the code, make sure it doesn't clash with another room/carpark")}
          </p>
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-gray-600">{t("类型", "Type")}</label>
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
            <option value="">-- {t("选类型", "Select Type")} --</option>
            {ROOM_TYPE_OPTIONS.map((rt) => (
              <option key={rt} value={rt}>
                {rt}
              </option>
            ))}
            <option value="__custom__">{t("其他 (自己填)", "Other (Custom)")}</option>
          </select>
          {useCustomType && (
            <input
              value={customType}
              onChange={(e) => setCustomType(e.target.value)}
              className="input mt-2"
              placeholder={t("自己填类型", "Enter custom type")}
            />
          )}
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="mb-1.5 block text-sm text-gray-600">{t("房租", "Rental")} RM</label>
            <input
              type="number"
              value={roomRental}
              onChange={(e) => setRoomRental(e.target.value)}
              className="input"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1.5 block text-sm text-gray-600">{t("车位租金", "Carpark Rental")} RM</label>
            <input
              type="number"
              value={carparkRental}
              onChange={(e) => setCarparkRental(e.target.value)}
              className="input"
            />
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-gray-600">押金 Deposit RM (可退还)</label>
          <input
            type="number"
            value={securityDeposit}
            onChange={(e) => setSecurityDeposit(e.target.value)}
            className="input"
          />
        </div>
        <label className="flex cursor-pointer items-center gap-1.5 text-sm text-gray-600">
          <input type="checkbox" checked={hasAircon} onChange={(e) => setHasAircon(e.target.checked)} />
          ❄️ {t("有冷气", "Has Aircon")}
        </label>
        <label className="flex cursor-pointer items-center gap-1.5 text-sm text-gray-600">
          <input type="checkbox" checked={isCarpark} onChange={(e) => setIsCarpark(e.target.checked)} />
          🅿️ {t("这是车位专用 (不是房间，只租车位)", "This is a carpark-only lot (not a room, rented as carpark only)")}
        </label>
        {isCarpark && (
          <div>
            <label className="mb-1.5 block text-sm text-gray-600">车位编号 Carpark Lot</label>
            <input
              value={carparkLotNumber}
              onChange={(e) => setCarparkLotNumber(e.target.value)}
              className="input"
              placeholder={t("例: B-123", "e.g. B-123")}
            />
            <p className="mt-1 text-xs text-gray-400">
              {t(
                "建筑物本身画的车位号码 (跟系统内部的 Room Code 可以不一样)",
                "The lot number painted in the building itself (can differ from the system's internal Room Code)"
              )}
            </p>
          </div>
        )}
        <div>
          <label className="mb-1.5 block text-sm text-gray-600">
            📷 {t("房间照片 (Google Drive 链接)", "Room Photo (Google Drive Link)")}
          </label>
          <input
            value={photoLink}
            onChange={(e) => setPhotoLink(e.target.value)}
            className="input"
            placeholder="https://drive.google.com/..."
          />
          <p className="mt-1 text-xs text-gray-400">
            {t(
              "贴一个 Drive 文件夹/相册链接，Agent 就能直接看房间照片",
              "Paste a Drive folder/album link so Agents can view the room photos directly"
            )}
          </p>
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-gray-600">备注 Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="input" />
        </div>
        <button onClick={save} disabled={saving} className="btn-primary w-full">
          {saving ? t("保存中...", "Saving...") : t("保存", "Save")}
        </button>
      </div>
    </Modal>
  );
}
