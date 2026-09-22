"use client";

import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/components/Toast";
import { useT } from "@/components/LanguageProvider";
import { ROOM_TYPE_OPTIONS } from "@/lib/config";

interface PropertyOption {
  propertyCode: string;
  name: string;
}

export default function NewRoomClient() {
  const router = useRouter();
  const toast = useToast();
  const t = useT();
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [form, setForm] = useState({
    roomCode: "",
    propertyCode: "",
    roomType: "",
    roomRental: "",
    securityDeposit: "",
    carparkLotNumber: "",
    hasAircon: false,
    isCarpark: false,
  });
  const [useCustomType, setUseCustomType] = useState(false);
  const [customType, setCustomType] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/properties");
      const data = await res.json();
      if (data.success) setProperties(data.properties);
    })();
  }, []);

  async function addRoom(e: FormEvent) {
    e.preventDefault();
    if (!form.roomCode || !form.propertyCode) {
      toast.warning(t("Room Code 和楼盘一定要选", "Room Code and Property are required"));
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, roomType: useCustomType ? customType : form.roomType }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        router.push("/rooms");
      } else {
        toast.danger(data.message);
      }
    } catch {
      toast.danger(t("系统出错，请稍后再试", "System error — please try again later"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-xl bg-white p-5 shadow-sm">
        <div className="mb-3.5 flex items-center justify-between">
          <h3 className="text-base font-semibold text-brand">➕ {t("加新房间", "Add New Room")}</h3>
          <Link href="/rooms" className="text-sm text-gray-500 hover:underline">
            ← {t("返回房间清单", "Back to Room List")}
          </Link>
        </div>

        {properties.length === 0 && (
          <div className="mb-3.5 text-sm text-gray-500">
            {t("还没有楼盘, 先去", "No properties yet, go to")}{" "}
            <Link href="/units" className="text-brand underline">
              {t("楼盘管理", "Property Management")}
            </Link>{" "}
            {t("建一个", "to create one first")}
          </div>
        )}

        <form onSubmit={addRoom} className="space-y-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Room Code">
              <input
                value={form.roomCode}
                onChange={(e) => setForm({ ...form, roomCode: e.target.value })}
                className="input"
                placeholder={t("例: MMB-01", "e.g. MMB-01")}
              />
            </Field>
            <Field label="楼盘 Unit">
              <select
                value={form.propertyCode}
                onChange={(e) => setForm({ ...form, propertyCode: e.target.value })}
                className="input"
              >
                <option value="">-- {t("选楼盘", "Select Property")} --</option>
                {properties.map((p) => (
                  <option key={p.propertyCode} value={p.propertyCode}>
                    {p.propertyCode} ({p.name})
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("类型", "Type")}>
              <select
                value={useCustomType ? "__custom__" : form.roomType}
                onChange={(e) => {
                  if (e.target.value === "__custom__") {
                    setUseCustomType(true);
                  } else {
                    setUseCustomType(false);
                    setForm({ ...form, roomType: e.target.value });
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
            </Field>
            <Field label={`${t("房租", "Rental")} RM`}>
              <input
                type="number"
                value={form.roomRental}
                onChange={(e) => setForm({ ...form, roomRental: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="押金 Deposit RM (可退还)">
              <input
                type="number"
                value={form.securityDeposit}
                onChange={(e) => setForm({ ...form, securityDeposit: e.target.value })}
                className="input"
              />
            </Field>
          </div>

          <label className="flex cursor-pointer items-center gap-1.5 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={form.hasAircon}
              onChange={(e) => setForm({ ...form, hasAircon: e.target.checked })}
            />
            ❄️ {t("有冷气", "Has Aircon")}
          </label>
          <label className="flex cursor-pointer items-center gap-1.5 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={form.isCarpark}
              onChange={(e) => setForm({ ...form, isCarpark: e.target.checked })}
            />
            🅿️ {t("这是车位专用 (不是房间，只租车位)", "This is a carpark-only lot (not a room, rented as carpark only)")}
          </label>
          {form.isCarpark && (
            <Field label="车位编号 Carpark Lot">
              <input
                value={form.carparkLotNumber}
                onChange={(e) => setForm({ ...form, carparkLotNumber: e.target.value })}
                className="input"
                placeholder={t("例: B-123", "e.g. B-123")}
              />
            </Field>
          )}

          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? t("加入中...", "Adding...") : t("加入房间", "Add Room")}
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm text-gray-600">{label}</label>
      {children}
    </div>
  );
}
