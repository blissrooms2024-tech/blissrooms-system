"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Lightbox from "@/components/Lightbox";
import { useToast } from "@/components/Toast";
import { ROOM_STATUS_BADGE, roomStatusLabel, contractStatusLabel } from "@/lib/config";
import { fmtDate } from "@/lib/format";
import { useLanguage } from "@/components/LanguageProvider";

interface RoomDetail {
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
  status: string;
  notes: string | null;
  photoLink: string | null;
  photos: string[];
  currentTenant: { name: string; email: string; phone: string | null } | null;
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
interface ContractRow {
  contractCode: string;
  tenantName: string;
  agentName: string;
  status: string;
  moveInDate: string | null;
  expiredDate: string | null;
  totalOutstanding: number;
}

export default function RoomDetailClient({ roomCode, role }: { roomCode: string; role: string }) {
  const toast = useToast();
  const { locale, t } = useLanguage();
  const [room, setRoom] = useState<RoomDetail | null>(null);
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [error, setError] = useState("");
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/rooms/${roomCode}`);
      const data = await res.json();
      if (!data.success) {
        setError(data.message);
        return;
      }
      setRoom(data.room);
      setContracts(data.contracts);
    } catch {
      setError(t("出错，请稍后再试", "Something went wrong — please try again later"));
    }
  }, [roomCode, t]);

  useEffect(() => {
    // setState happens after the fetch's await, not synchronously in the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function uploadPhoto(file: File) {
    if (file.size > 3 * 1024 * 1024) {
      toast.warning(t("图片太大(超过3MB)，请压缩", "Image is too large (over 3MB) — please compress it"));
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await readAsDataURL(file);
      const res = await fetch(`/api/rooms/${roomCode}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        load();
      } else {
        toast.danger(data.message);
      }
    } catch {
      toast.danger(t("系统出错，请稍后再试", "System error — please try again later"));
    } finally {
      setUploading(false);
    }
  }

  async function deletePhoto(url: string) {
    const res = await fetch(`/api/rooms/${roomCode}/photos`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();
    if (data.success) {
      toast.success(data.message);
      load();
    } else {
      toast.danger(data.message);
    }
  }

  if (error) return <div className="rounded-xl bg-white p-5 text-sm text-red-600 shadow-sm">{error}</div>;
  if (!room)
    return <div className="rounded-xl bg-white p-5 text-sm text-gray-500 shadow-sm">{t("载入中...", "Loading...")}</div>;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="rounded-xl bg-white p-5 shadow-sm">
        <div className="mb-3.5 flex items-center justify-between">
          <h3 className="text-base font-semibold text-brand">
            {room.isCarpark ? "🅿️" : "🏠"} {room.roomCode}
          </h3>
          <Link href="/rooms" className="text-sm text-gray-500 hover:underline">
            ← {t("返回房间清单", "Back to Room List")}
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <Info label={t("楼盘 Unit", "Property")}>
            {room.propertyCode ? (
              <Link href={`/units/${room.propertyCode}`} className="text-brand hover:underline">
                {room.propertyName}
              </Link>
            ) : (
              room.propertyName || t("未分配", "Unassigned")
            )}
          </Info>
          <Info label={t("类型", "Type")}>{room.roomType || "-"}</Info>
          <Info label={t("状态", "Status")}>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${ROOM_STATUS_BADGE[room.status]}`}>
              {roomStatusLabel(room.status, locale) ?? room.status}
            </span>
          </Info>
          {!room.isCarpark && <Info label={t("房租", "Rental")}>RM{room.roomRental}</Info>}
          <Info label={t("车位租金", "Carpark Rental")}>RM{room.carparkRental}</Info>
          <Info label={t("押金 Deposit (可退还)", "Deposit (Refundable)")}>RM{room.securityDeposit}</Info>
          {room.isCarpark && <Info label={t("车位编号", "Carpark Lot")}>{room.carparkLotNumber || "-"}</Info>}
          {!room.isCarpark && (
            <Info label={t("冷气", "Aircon")}>{room.hasAircon ? `❄️ ${t("有", "Yes")}` : `- ${t("没有", "No")}`}</Info>
          )}
        </div>

        {room.currentTenant && (
          <div className="mt-3.5 rounded-lg bg-brand-light/40 p-3 text-sm">
            <b className="text-brand">👤 {t("现在的租客", "Current Tenant")}</b>
            <div className="mt-1">{room.currentTenant.name}</div>
            <div className="text-xs text-gray-500">
              {room.currentTenant.email}
              {room.currentTenant.phone ? ` · ${room.currentTenant.phone}` : ""}
            </div>
          </div>
        )}

        <div className="mt-3.5">
          <b className="mb-1.5 block text-sm text-gray-600">📷 {t("房间照片", "Room Photos")}</b>
          {room.photos.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {room.photos.map((url) => (
                <div key={url} className="group relative">
                  <button type="button" onClick={() => setZoomUrl(url)} className="block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={t("房间照片", "Room Photo")}
                      className="h-20 w-20 rounded-lg border border-gray-200 object-cover"
                    />
                  </button>
                  <a
                    href={url}
                    download
                    className="absolute inset-x-0 bottom-0 rounded-b-lg bg-black/60 py-0.5 text-center text-[11px] text-white opacity-0 group-hover:opacity-100"
                  >
                    ⬇️ {t("下载", "Download")}
                  </a>
                  {role === "ADMIN" && (
                    <button
                      type="button"
                      onClick={() => deletePhoto(url)}
                      className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white opacity-0 group-hover:opacity-100"
                      title={t("删除照片", "Delete Photo")}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">{t("还没有照片", "No photos yet")}</p>
          )}
          {role === "ADMIN" && (
            <div className="mt-2">
              <input
                type="file"
                accept="image/*"
                disabled={uploading}
                onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0])}
                className="block text-sm text-gray-500 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-brand file:px-3.5 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-brand-dark disabled:opacity-50"
              />
              {uploading && <span className="ml-2 text-sm text-gray-500">{t("上传中...", "Uploading...")}</span>}
            </div>
          )}
          {room.photoLink && (
            <a href={room.photoLink} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-block text-sm text-brand underline">
              🔗 {t("查看相册链接", "View Album Link")}
            </a>
          )}
        </div>

        {zoomUrl && <Lightbox src={zoomUrl} alt={t("房间照片", "Room Photo")} onClose={() => setZoomUrl(null)} />}

        {room.notes && (
          <div className="mt-3.5 rounded-lg bg-gray-50 p-3 text-sm text-gray-600">📝 {room.notes}</div>
        )}
      </div>

      <div className="rounded-xl bg-white p-5 shadow-sm">
        <h3 className="mb-3.5 text-base font-semibold text-brand">
          📄 {t("合同记录", "Contract Records")} ({contracts.length})
        </h3>
        {contracts.length === 0 ? (
          <div className="py-6 text-center text-sm text-gray-400">
            {t("这间房还没有任何合同记录", "This room has no contract records yet")}
          </div>
        ) : (
          <div className="space-y-2">
            {contracts.map((c) => (
              <div key={c.contractCode} className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-50 py-2 text-sm last:border-none">
                <div>
                  <Link href={`/contracts/${c.contractCode}`} className="font-semibold text-brand hover:underline">
                    {c.contractCode}
                  </Link>{" "}
                  · {c.tenantName} · {c.agentName}
                  {(c.moveInDate || c.expiredDate) && (
                    <div className="text-xs text-gray-400">
                      {fmtDate(c.moveInDate)} ~ {fmtDate(c.expiredDate)}
                    </div>
                  )}
                </div>
                <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-600">
                  {contractStatusLabel(c.status, locale) ?? c.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-gray-400">{label}</div>
      <div>{children}</div>
    </div>
  );
}
