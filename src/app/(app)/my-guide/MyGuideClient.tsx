"use client";

import { useState } from "react";
import { NOTICE_TITLES } from "@/lib/contractContent";
import { CONTRACT_IMAGES } from "@/lib/config";
import { useLanguage } from "@/components/LanguageProvider";
import Lightbox from "@/components/Lightbox";
import { SupportList } from "@/components/SupportContact";

/** 入住指南 — the property notices / SOPs that used to be the contract's appendix.
 * Reference only (no signature), so tenants can look things up any time. */
export default function MyGuideClient() {
  const { t } = useLanguage();
  const [open, setOpen] = useState<number | null>(0);
  const [zoom, setZoom] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-white p-4 shadow-sm sm:p-5">
        <h3 className="text-base font-bold text-brand sm:text-lg">{t("📘 入住指南", "📘 Move-in Guide")}</h3>
        <p className="mt-1 text-sm text-gray-500">
          {t(
            "住在这里的日常须知：公共区域、厨房、厕所、洗衣、Wi-Fi、跳电、钥匙门锁等。点开每一项查看。",
            "Everyday know-how for living here: common areas, kitchen, toilet, laundry, Wi-Fi, power trips, keys and locks. Tap each item to read."
          )}
        </p>
      </div>

      <div className="space-y-2">
        {NOTICE_TITLES.map((title, i) => {
          const img = CONTRACT_IMAGES.notices[i];
          const isOpen = open === i;
          return (
            <div key={i} className="overflow-hidden rounded-xl bg-white shadow-sm">
              <button
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
              >
                <span className="text-sm font-semibold text-gray-800">
                  {i + 1}. {title}
                </span>
                <span className={`text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}>▾</span>
              </button>
              {isOpen && (
                <div className="border-t border-gray-100 px-4 py-3">
                  {img ? (
                    <button type="button" onClick={() => setZoom(img)} className="block w-full cursor-zoom-in">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img} alt={title} className="w-full rounded-lg border border-gray-200" />
                      <span className="mt-1 block text-center text-xs text-gray-400">{t("点图片放大", "Tap image to zoom")}</span>
                    </button>
                  ) : (
                    <p className="text-sm text-gray-400">{t("内容准备中", "Content coming soon")}</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="rounded-xl bg-white p-4 shadow-sm sm:p-5">
        <b className="mb-2 block text-sm">{t("🎧 有问题找谁？", "🎧 Who to contact")}</b>
        <SupportList compact />
      </div>

      {zoom && <Lightbox src={zoom} alt="" onClose={() => setZoom(null)} />}
    </div>
  );
}
