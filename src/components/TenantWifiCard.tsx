"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "./LanguageProvider";
import { useToast } from "./Toast";

interface Wifi {
  propertyName: string;
  roomCode: string;
  wifiName: string | null;
  wifiPassword: string | null;
}

/** Shows the tenant their unit's WiFi so they don't have to ask. Renders nothing if not set. */
export default function TenantWifiCard() {
  const { t } = useLanguage();
  const toast = useToast();
  const [wifi, setWifi] = useState<Wifi[]>([]);

  useEffect(() => {
    fetch("/api/my-wifi")
      .then((r) => r.json())
      .then((d) => d.success && setWifi(d.wifi))
      .catch(() => {});
  }, []);

  if (wifi.length === 0) return null;

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t("已复制", "Copied"));
    } catch {
      toast.warning(t("复制失败，请手动复制", "Couldn't copy — please copy it manually"));
    }
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <b className="mb-2 block text-sm text-gray-600">📶 {t("单位 WiFi", "Unit WiFi")}</b>
      <div className="space-y-2.5">
        {wifi.map((w) => (
          <div key={w.roomCode} className="rounded-lg bg-brand-light/60 p-3 text-sm">
            {wifi.length > 1 && <div className="mb-1 text-xs text-gray-500">{w.propertyName}</div>}
            {w.wifiName && (
              <div className="flex items-center justify-between gap-2">
                <span>
                  <span className="text-gray-500">{t("名称", "Name")}: </span>
                  <b className="break-all">{w.wifiName}</b>
                </span>
              </div>
            )}
            {w.wifiPassword && (
              <div className="mt-1 flex items-center justify-between gap-2">
                <span>
                  <span className="text-gray-500">{t("密码", "Password")}: </span>
                  <b className="break-all font-mono">{w.wifiPassword}</b>
                </span>
                <button onClick={() => copy(w.wifiPassword!)} className="btn-soft shrink-0 px-3 py-1.5 text-xs">
                  {t("复制", "Copy")}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
