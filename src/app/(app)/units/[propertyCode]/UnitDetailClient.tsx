"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ROOM_STATUS_LABELS } from "@/lib/config";

interface RoomRow {
  roomCode: string;
  roomType: string | null;
  status: string;
  isCarpark: boolean;
}
interface PropertyDetail {
  propertyCode: string;
  name: string;
  address: string | null;
  region: string | null;
  landlord: string | null;
  managementFeeRate: number | null;
  status: string | null;
  notes: string | null;
  rooms: RoomRow[];
}

const STATUS_BADGE: Record<string, string> = {
  VACANT: "bg-green-50 text-green-700",
  OCCUPIED: "bg-red-50 text-red-700",
  RESERVED: "bg-yellow-50 text-yellow-800",
  MAINTENANCE: "bg-gray-100 text-gray-600",
  STORE: "bg-indigo-50 text-indigo-700",
};

export default function UnitDetailClient({ propertyCode }: { propertyCode: string }) {
  const [property, setProperty] = useState<PropertyDetail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/properties/${propertyCode}`);
        const data = await res.json();
        if (!data.success) {
          setError(data.message);
          return;
        }
        setProperty(data.property);
      } catch {
        setError("出错，请稍后再试");
      }
    })();
  }, [propertyCode]);

  if (error) return <div className="rounded-xl bg-white p-5 text-sm text-red-600 shadow-sm">{error}</div>;
  if (!property) return <div className="rounded-xl bg-white p-5 text-sm text-gray-500 shadow-sm">载入中...</div>;

  return (
    <div className="rounded-xl bg-white p-5 shadow-sm">
      <div className="mb-3.5 flex items-center justify-between">
        <h3 className="text-base font-semibold text-brand">🏢 {property.name}</h3>
        <Link href="/units" className="text-sm text-gray-500 hover:underline">
          ← 返回楼盘清单
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <Info label="楼盘号">{property.propertyCode}</Info>
        <Info label="地址">{property.address || "-"}</Info>
        <Info label="地区">{property.region || "-"}</Info>
        <Info label="Landlord">{property.landlord || "自己名下"}</Info>
        <Info label="管理费">
          {property.landlord && property.managementFeeRate ? `${(property.managementFeeRate * 100).toFixed(1)}%` : "-"}
        </Info>
        <Info label="状态">{property.status || "-"}</Info>
      </div>

      {property.notes && (
        <div className="mt-3.5 rounded-lg bg-gray-50 p-3 text-sm text-gray-600">📝 {property.notes}</div>
      )}

      <div className="mt-4 border-t border-gray-100 pt-3.5">
        <h4 className="mb-2.5 text-sm font-semibold text-brand">🏠 房间 / 车位 ({property.rooms.length})</h4>
        {property.rooms.length === 0 ? (
          <div className="py-4 text-center text-sm text-gray-400">这个楼盘还没有房间</div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {property.rooms.map((r) => (
              <Link
                key={r.roomCode}
                href={`/rooms/${r.roomCode}`}
                className="flex items-center justify-between rounded-lg border border-gray-100 px-2.5 py-2 text-sm hover:border-brand hover:bg-brand-light/20"
              >
                <span className="font-semibold text-brand">
                  {r.isCarpark ? "🅿️" : "🏠"} {r.roomCode}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE[r.status]}`}>
                  {ROOM_STATUS_LABELS[r.status] ?? r.status}
                </span>
              </Link>
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
