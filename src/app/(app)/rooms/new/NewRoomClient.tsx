"use client";

import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/components/Toast";
import { ROOM_TYPE_OPTIONS } from "@/lib/config";

interface PropertyOption {
  propertyCode: string;
  name: string;
}

export default function NewRoomClient() {
  const router = useRouter();
  const toast = useToast();
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
      toast.warning("Room Code 和楼盘一定要选");
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
      toast.danger("系统出错，请稍后再试");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-xl bg-white p-5 shadow-sm">
        <div className="mb-3.5 flex items-center justify-between">
          <h3 className="text-base font-semibold text-brand">➕ 加新房间</h3>
          <Link href="/rooms" className="text-sm text-gray-500 hover:underline">
            ← 返回房间清单
          </Link>
        </div>

        {properties.length === 0 && (
          <div className="mb-3.5 text-sm text-gray-500">
            还没有楼盘, 先去{" "}
            <Link href="/units" className="text-brand underline">
              楼盘管理
            </Link>{" "}
            建一个
          </div>
        )}

        <form onSubmit={addRoom} className="space-y-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Room Code">
              <input
                value={form.roomCode}
                onChange={(e) => setForm({ ...form, roomCode: e.target.value })}
                className="input"
                placeholder="例: MMB-01"
              />
            </Field>
            <Field label="楼盘 Unit">
              <select
                value={form.propertyCode}
                onChange={(e) => setForm({ ...form, propertyCode: e.target.value })}
                className="input"
              >
                <option value="">-- 选楼盘 --</option>
                {properties.map((p) => (
                  <option key={p.propertyCode} value={p.propertyCode}>
                    {p.propertyCode} ({p.name})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="类型">
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
                <option value="">-- 选类型 --</option>
                {ROOM_TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
                <option value="__custom__">其他 (自己填)</option>
              </select>
              {useCustomType && (
                <input
                  value={customType}
                  onChange={(e) => setCustomType(e.target.value)}
                  className="input mt-2"
                  placeholder="自己填类型"
                />
              )}
            </Field>
            <Field label="房租 RM">
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
            ❄️ 有冷气
          </label>
          <label className="flex cursor-pointer items-center gap-1.5 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={form.isCarpark}
              onChange={(e) => setForm({ ...form, isCarpark: e.target.checked })}
            />
            🅿️ 这是车位专用 (不是房间，只租车位)
          </label>
          {form.isCarpark && (
            <Field label="车位编号 Carpark Lot">
              <input
                value={form.carparkLotNumber}
                onChange={(e) => setForm({ ...form, carparkLotNumber: e.target.value })}
                className="input"
                placeholder="例: B-123"
              />
            </Field>
          )}

          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? "加入中..." : "加入房间"}
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
