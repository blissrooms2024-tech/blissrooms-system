"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ROOM_STATUS_LABELS, CONTRACT_STATUS_LABELS } from "@/lib/config";

interface RoomDetail {
  roomCode: string;
  propertyCode: string | null;
  propertyName: string;
  roomType: string | null;
  roomRental: number;
  carparkRental: number;
  carparkLotNumber: string | null;
  hasAircon: boolean;
  isCarpark: boolean;
  status: string;
  notes: string | null;
  photoLink: string | null;
  currentTenant: { name: string; email: string; phone: string | null } | null;
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

const STATUS_BADGE: Record<string, string> = {
  VACANT: "bg-green-50 text-green-700",
  OCCUPIED: "bg-red-50 text-red-700",
  RESERVED: "bg-yellow-50 text-yellow-800",
  MAINTENANCE: "bg-gray-100 text-gray-600",
};

export default function RoomDetailClient({ roomCode }: { roomCode: string }) {
  const [room, setRoom] = useState<RoomDetail | null>(null);
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
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
        setError("出错，请稍后再试");
      }
    })();
  }, [roomCode]);

  if (error) return <div className="rounded-xl bg-white p-5 text-sm text-red-600 shadow-sm">{error}</div>;
  if (!room) return <div className="rounded-xl bg-white p-5 text-sm text-gray-500 shadow-sm">载入中...</div>;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="rounded-xl bg-white p-5 shadow-sm">
        <div className="mb-3.5 flex items-center justify-between">
          <h3 className="text-base font-semibold text-brand">
            {room.isCarpark ? "🅿️" : "🏠"} {room.roomCode}
          </h3>
          <Link href="/rooms" className="text-sm text-gray-500 hover:underline">
            ← 返回房间清单
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <Info label="楼盘 Unit">
            {room.propertyCode ? (
              <Link href={`/units/${room.propertyCode}`} className="text-brand hover:underline">
                {room.propertyName}
              </Link>
            ) : (
              room.propertyName || "未分配"
            )}
          </Info>
          <Info label="类型">{room.roomType || "-"}</Info>
          <Info label="状态">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE[room.status]}`}>
              {ROOM_STATUS_LABELS[room.status] ?? room.status}
            </span>
          </Info>
          {!room.isCarpark && <Info label="房租">RM{room.roomRental}</Info>}
          <Info label="车位租金">RM{room.carparkRental}</Info>
          {room.isCarpark && <Info label="车位编号">{room.carparkLotNumber || "-"}</Info>}
          {!room.isCarpark && <Info label="冷气">{room.hasAircon ? "❄️ 有" : "- 没有"}</Info>}
        </div>

        {room.currentTenant && (
          <div className="mt-3.5 rounded-lg bg-brand-light/40 p-3 text-sm">
            <b className="text-brand">👤 现在的租客</b>
            <div className="mt-1">{room.currentTenant.name}</div>
            <div className="text-xs text-gray-500">
              {room.currentTenant.email}
              {room.currentTenant.phone ? ` · ${room.currentTenant.phone}` : ""}
            </div>
          </div>
        )}

        {room.photoLink && (
          <div className="mt-3.5">
            <a href={room.photoLink} target="_blank" rel="noopener noreferrer" className="text-sm text-brand underline">
              📷 查看房间照片
            </a>
          </div>
        )}

        {room.notes && (
          <div className="mt-3.5 rounded-lg bg-gray-50 p-3 text-sm text-gray-600">📝 {room.notes}</div>
        )}
      </div>

      <div className="rounded-xl bg-white p-5 shadow-sm">
        <h3 className="mb-3.5 text-base font-semibold text-brand">📄 合同记录 ({contracts.length})</h3>
        {contracts.length === 0 ? (
          <div className="py-6 text-center text-sm text-gray-400">这间房还没有任何合同记录</div>
        ) : (
          <div className="space-y-2">
            {contracts.map((c) => (
              <div key={c.contractCode} className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-50 py-2 text-sm last:border-none">
                <div>
                  <Link href="/contracts" className="font-semibold text-brand hover:underline">
                    {c.contractCode}
                  </Link>{" "}
                  · {c.tenantName} · {c.agentName}
                  {(c.moveInDate || c.expiredDate) && (
                    <div className="text-xs text-gray-400">
                      {c.moveInDate?.slice(0, 10) ?? "-"} ~ {c.expiredDate?.slice(0, 10) ?? "-"}
                    </div>
                  )}
                </div>
                <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-600">
                  {CONTRACT_STATUS_LABELS[c.status] ?? c.status}
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
