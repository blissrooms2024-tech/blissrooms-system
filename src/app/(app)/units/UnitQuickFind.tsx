"use client";
import Link from "next/link";
import { useLanguage } from "@/components/LanguageProvider";
import { IconChevronRight } from "@/components/icons";
import TenantContact from "@/components/TenantContact";
import UnitRoomSelect, { roomLabel, unitLabel, type PickUnit, type UnitRoomValue } from "@/components/UnitRoomSelect";
import { contractStatusLabel, ROOM_STATUS_BADGE, roomStatusLabel } from "@/lib/config";

/**
 * Top of the 楼盘 page: 楼盘 → 单位号码 → 房间. Picking a 楼盘 narrows the list below; a unit
 * offers its page; a room shows who's in it, with call and WhatsApp right there.
 */
export default function UnitQuickFind({ units, value, onChange }: { units: PickUnit[]; value: UnitRoomValue; onChange: (v: UnitRoomValue) => void }) {
  const { t, locale } = useLanguage();
  const unit = units.find((u) => u.propertyCode === value.unit);
  const room = unit?.rooms?.find((r) => r.roomCode === value.room);

  return (
    <section aria-label={t("快速找", "Quick find")} className="space-y-2.5 rounded-2xl bg-white p-3 shadow-[0_1px_2px_rgba(30,27,46,0.05)] md:max-w-2xl">
      <UnitRoomSelect
        units={units}
        value={value}
        onChange={onChange}
        mode="filter"
        rooms="required"
        roomText={(r, u) => {
          const who = r.tenant ? [r.tenant.name, r.tenant.phone].filter(Boolean).join(" · ") : roomStatusLabel(r.status ?? "", locale);
          return `${roomLabel(r.roomCode, u.propertyCode)} · ${who}`;
        }}
      />

      {unit && !room && (
        <Link
          href={`/units/${unit.propertyCode}`}
          className="flex items-center gap-2 rounded-xl bg-brand-light/60 px-3 py-2.5 text-brand hover:bg-brand-light"
        >
          <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">
            {t(`打开 ${unitLabel(unit)}`, `Open ${unitLabel(unit)}`)}
            <span className="ml-1.5 text-[12px] font-normal text-brand/70">
              {unit.name} · {unit.propertyCode}
            </span>
          </span>
          <IconChevronRight size={16} className="shrink-0" />
        </Link>
      )}

      {unit && room && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <b className="text-[15px] font-semibold text-gray-900">{room.roomCode}</b>
            {room.roomType && <span className="truncate text-[12px] text-gray-500">{room.roomType}</span>}
            <span className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${ROOM_STATUS_BADGE[room.status ?? ""] ?? "bg-gray-100 text-gray-600"}`}>
              {roomStatusLabel(room.status ?? "", locale)}
            </span>
          </div>
          {room.tenant ? (
            <TenantContact
              name={room.tenant.name}
              phone={room.tenant.phone}
              note={room.tenant.status === "ACTIVE" ? room.tenant.contractCode : `${room.tenant.contractCode} · ${contractStatusLabel(room.tenant.status, locale)}`}
            />
          ) : (
            <p className="rounded-xl bg-gray-50 px-3 py-2 text-[13px] text-gray-500">{t("现在没有租客", "No tenant right now")}</p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Link
              href={`/rooms/${room.roomCode}`}
              className="flex h-10 items-center justify-center rounded-xl bg-gray-100 text-[13px] font-semibold text-gray-800 hover:bg-gray-200"
            >
              {t("打开房间", "Open room")}
            </Link>
            {room.tenant ? (
              <Link
                href={`/contracts/${room.tenant.contractCode}`}
                className="flex h-10 items-center justify-center rounded-xl bg-gray-100 text-[13px] font-semibold text-gray-800 hover:bg-gray-200"
              >
                {t("打开合同", "Open contract")}
              </Link>
            ) : (
              <Link
                href={`/units/${unit.propertyCode}`}
                className="flex h-10 items-center justify-center rounded-xl bg-gray-100 text-[13px] font-semibold text-gray-800 hover:bg-gray-200"
              >
                {t(`打开 ${unitLabel(unit)}`, `Open ${unitLabel(unit)}`)}
              </Link>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
