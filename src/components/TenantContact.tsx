"use client";
import { useLanguage } from "@/components/LanguageProvider";
import { IconChat } from "@/components/icons";
import { waNumber } from "@/lib/quote";

/** A tenant's name and phone, with WhatsApp and call buttons (shown when there's a phone). */
export default function TenantContact({ name, phone, note }: { name: string; phone: string | null; note?: string }) {
  const { t } = useLanguage();
  const wa = waNumber(phone);
  return (
    <div className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-semibold text-gray-900">{name}</div>
        <div className="truncate text-[12.5px] text-gray-500">
          {phone || t("没有电话", "No phone")}
          {note && ` · ${note}`}
        </div>
      </div>
      {phone && (
        <a
          href={`tel:${phone.replace(/[^\d+]/g, "")}`}
          aria-label={t(`打电话给 ${name}`, `Call ${name}`)}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-gray-700 shadow-[0_1px_2px_rgba(30,27,46,0.08)] hover:bg-gray-100"
        >
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 4h3l1.5 4-2 1.5a11 11 0 0 0 7 7L16 14.5l4 1.5v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />
          </svg>
        </a>
      )}
      {wa && (
        <a
          href={`https://wa.me/${wa}`}
          target="_blank"
          rel="noreferrer"
          aria-label={t(`WhatsApp ${name}`, `WhatsApp ${name}`)}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-[#25D366]/15 px-3 text-[13px] font-semibold text-[#128C7E] hover:bg-[#25D366]/25"
        >
          <IconChat size={16} />
          WhatsApp
        </a>
      )}
    </div>
  );
}
