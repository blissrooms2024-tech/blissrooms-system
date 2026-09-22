"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ROOM_STATUS_BADGE, roomStatusLabel } from "@/lib/config";
import { useLanguage } from "@/components/LanguageProvider";

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
  ownerRentalAmount: number | null;
  ownerDeposit: number | null;
  status: string | null;
  notes: string | null;
  rooms: RoomRow[];
}

export default function UnitDetailClient({ propertyCode }: { propertyCode: string }) {
  const { locale, t } = useLanguage();
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
        setError(t("出错，请稍后再试", "Something went wrong — please try again later"));
      }
    })();
  }, [propertyCode, t]);

  if (error) return <div className="rounded-xl bg-white p-5 text-sm text-red-600 shadow-sm">{error}</div>;
  if (!property)
    return <div className="rounded-xl bg-white p-5 text-sm text-gray-500 shadow-sm">{t("载入中...", "Loading...")}</div>;

  return (
    <div className="rounded-xl bg-white p-5 shadow-sm">
      <div className="mb-3.5 flex items-center justify-between">
        <h3 className="text-base font-semibold text-brand">🏢 {property.name}</h3>
        <Link href="/units" className="text-sm text-gray-500 hover:underline">
          {t("← 返回楼盘清单", "← Back to Property List")}
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <Info label={t("楼盘号", "Property Code")}>{property.propertyCode}</Info>
        <Info label={t("地址", "Address")}>{property.address || "-"}</Info>
        <Info label={t("地区", "Region")}>{property.region || "-"}</Info>
        <Info label={property.ownerRentalAmount !== null ? "Owner" : "Landlord"}>
          {property.landlord || t("自己名下", "Self-owned")}
        </Info>
        <Info label={property.ownerRentalAmount !== null ? t("付 Owner 租金", "Rent to Owner") : t("管理费", "Management Fee")}>
          {property.ownerRentalAmount !== null
            ? `RM${property.ownerRentalAmount}`
            : property.managementFeeRate
              ? `${(property.managementFeeRate * 100).toFixed(1)}%`
              : "-"}
        </Info>
        {property.ownerRentalAmount !== null && (
          <Info label={t("付 Owner 押金 (可退还)", "Deposit to Owner (Refundable)")}>
            {property.ownerDeposit !== null ? `RM${property.ownerDeposit}` : "-"}
          </Info>
        )}
        <Info label={t("状态", "Status")}>{property.status || "-"}</Info>
      </div>

      {property.notes && (
        <div className="mt-3.5 rounded-lg bg-gray-50 p-3 text-sm text-gray-600">📝 {property.notes}</div>
      )}

      <div className="mt-4 border-t border-gray-100 pt-3.5">
        <h4 className="mb-2.5 text-sm font-semibold text-brand">
          {t("🏠 房间 / 车位", "🏠 Rooms / Parking")} ({property.rooms.length})
        </h4>
        {property.rooms.length === 0 ? (
          <div className="py-4 text-center text-sm text-gray-400">
            {t("这个楼盘还没有房间", "This property has no rooms yet")}
          </div>
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
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${ROOM_STATUS_BADGE[r.status]}`}>
                  {roomStatusLabel(r.status, locale)}
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
