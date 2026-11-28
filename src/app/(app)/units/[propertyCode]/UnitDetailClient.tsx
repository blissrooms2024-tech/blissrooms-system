"use client";

import { useCallback, useEffect, useState } from "react";
import { fmtMoney } from "@/lib/format";
import { useLanguage } from "@/components/LanguageProvider";
import { IconPen } from "@/components/icons";
import PropertyEditModal from "../PropertyEditModal";

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

/** 基本资料 on the unit's 资料 tab: code, address, owner deal, status — and (Admin) the edit form
 * for them. Rooms, notes and money each have their own tab now. */
export default function UnitDetailClient({ propertyCode, canEdit, onChanged }: { propertyCode: string; canEdit: boolean; onChanged?: () => void }) {
  const { t } = useLanguage();
  const [property, setProperty] = useState<PropertyDetail | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
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
  }, [propertyCode, t]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- first load; state is set after the fetch resolves
    void load();
  }, [load]);

  if (error) return <div className="rounded-2xl bg-white p-4 text-sm text-rose-600 shadow-sm">{error}</div>;
  if (!property) return <div className="h-32 animate-pulse rounded-2xl bg-white/80 motion-reduce:animate-none" />;

  return (
    <section className="rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(30,27,46,0.05)]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-[15px] font-semibold text-gray-900">{t("基本资料", "Basics")}</h2>
        {canEdit && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex h-8 items-center gap-1 rounded-lg bg-brand-light px-2.5 text-[12px] font-semibold text-brand hover:bg-violet-100"
          >
            <IconPen size={14} />
            {t("编辑", "Edit")}
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <Info label={t("楼盘号", "Property Code")}>{property.propertyCode}</Info>
        <Info label={t("地址", "Address")}>{property.address || "-"}</Info>
        <Info label={t("地区", "Region")}>{property.region || "-"}</Info>
        <Info label={property.ownerRentalAmount !== null ? "Owner" : "Landlord"}>{property.landlord || t("自己名下", "Self-owned")}</Info>
        <Info label={property.ownerRentalAmount !== null ? t("付 Owner 租金", "Rent to Owner") : t("管理费", "Management Fee")}>
          {property.ownerRentalAmount !== null
            ? fmtMoney(property.ownerRentalAmount)
            : property.managementFeeRate
              ? `${(property.managementFeeRate * 100).toFixed(1)}%`
              : "-"}
        </Info>
        {property.ownerRentalAmount !== null && <Info label={t("付 Owner 押金 (可退还)", "Deposit to Owner (Refundable)")}>{fmtMoney(property.ownerDeposit)}</Info>}
        <Info label={t("状态", "Status")}>{property.status || "-"}</Info>
      </div>

      {editing && (
        <PropertyEditModal
          property={{
            ...property,
            roomCount: property.rooms.filter((r) => !r.isCarpark).length,
            carparkCount: property.rooms.filter((r) => r.isCarpark).length,
          }}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            void load();
            onChanged?.();
          }}
        />
      )}
    </section>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-gray-400">{label}</div>
      <div className="break-words">{children}</div>
    </div>
  );
}
