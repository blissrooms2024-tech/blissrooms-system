"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/components/Toast";

const emptyForm = {
  propertyCode: "",
  name: "",
  address: "",
  region: "",
  landlord: "",
  managementFeeRate: "",
  ownerRentalAmount: "",
  ownerDeposit: "",
  roomCount: "",
  carparkCount: "",
};

type DealType = "OWN" | "MANAGED" | "MASTER_LEASE";

export default function NewUnitClient() {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState(emptyForm);
  const [dealType, setDealType] = useState<DealType>("OWN");
  const [submitting, setSubmitting] = useState(false);

  async function addProperty(e: FormEvent) {
    e.preventDefault();
    if (!form.propertyCode.trim()) {
      toast.warning("楼盘代号一定要填");
      return;
    }
    if (!form.name.trim()) {
      toast.warning("楼盘名字一定要填");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          managementFeeRate:
            dealType === "MANAGED" && form.managementFeeRate ? Number(form.managementFeeRate) / 100 : undefined,
          ownerRentalAmount:
            dealType === "MASTER_LEASE" && form.ownerRentalAmount ? Number(form.ownerRentalAmount) : undefined,
          ownerDeposit: dealType === "MASTER_LEASE" && form.ownerDeposit ? Number(form.ownerDeposit) : undefined,
          roomCount: form.roomCount || 0,
          carparkCount: form.carparkCount || 0,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        router.push("/units");
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
          <h3 className="text-base font-semibold text-brand">➕ 加新楼盘 (Unit)</h3>
          <Link href="/units" className="text-sm text-gray-500 hover:underline">
            ← 返回楼盘清单
          </Link>
        </div>

        <form onSubmit={addProperty} className="space-y-5">
          <section>
            <h4 className="mb-2.5 text-sm font-semibold text-gray-500">基本资料</h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="楼盘代号 (Unit Code，例: MMB)">
                <input
                  className="input uppercase"
                  value={form.propertyCode}
                  onChange={(e) => setForm({ ...form, propertyCode: e.target.value })}
                  placeholder="例: MMB"
                />
              </Field>
              <Field label="楼盘名字">
                <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
              <Field label="地址">
                <input
                  className="input"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </Field>
              <Field label="地区">
                <input className="input" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} />
              </Field>
            </div>
          </section>

          <section>
            <h4 className="mb-2.5 text-sm font-semibold text-gray-500">楼盘性质</h4>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {(
                [
                  { v: "OWN", l: "自己名下" },
                  { v: "MANAGED", l: "帮人管理 (收管理费%)" },
                  { v: "MASTER_LEASE", l: "跟 Owner 租 (付固定租金)" },
                ] as { v: DealType; l: string }[]
              ).map((opt) => (
                <label
                  key={opt.v}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm ${
                    dealType === opt.v ? "border-brand bg-brand-light/40 font-semibold text-brand" : "border-gray-200 text-gray-600"
                  }`}
                >
                  <input
                    type="radio"
                    name="dealType"
                    checked={dealType === opt.v}
                    onChange={() => setDealType(opt.v)}
                  />
                  {opt.l}
                </label>
              ))}
            </div>
            {dealType !== "OWN" && (
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label={dealType === "MASTER_LEASE" ? "Owner (业主)" : "Landlord"}>
                  <input
                    className="input"
                    value={form.landlord}
                    onChange={(e) => setForm({ ...form, landlord: e.target.value })}
                  />
                </Field>
                {dealType === "MANAGED" ? (
                  <Field label="管理费 % (例10)">
                    <input
                      type="number"
                      step="0.1"
                      className="input"
                      value={form.managementFeeRate}
                      onChange={(e) => setForm({ ...form, managementFeeRate: e.target.value })}
                    />
                  </Field>
                ) : (
                  <>
                    <Field label="每月付 Owner 租金 RM">
                      <input
                        type="number"
                        step="1"
                        className="input"
                        value={form.ownerRentalAmount}
                        onChange={(e) => setForm({ ...form, ownerRentalAmount: e.target.value })}
                      />
                    </Field>
                    <Field label="付 Owner 押金 RM (可退还)">
                      <input
                        type="number"
                        step="1"
                        className="input"
                        value={form.ownerDeposit}
                        onChange={(e) => setForm({ ...form, ownerDeposit: e.target.value })}
                      />
                    </Field>
                  </>
                )}
              </div>
            )}
          </section>

          <section>
            <h4 className="mb-2.5 text-sm font-semibold text-gray-500">自动加房间/车位 (选填)</h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="房间数量">
                <input
                  type="number"
                  min="0"
                  className="input"
                  placeholder="例: 4"
                  value={form.roomCount}
                  onChange={(e) => setForm({ ...form, roomCount: e.target.value })}
                />
              </Field>
              <Field label="车位数量">
                <input
                  type="number"
                  min="0"
                  className="input"
                  placeholder="例: 2"
                  value={form.carparkCount}
                  onChange={(e) => setForm({ ...form, carparkCount: e.target.value })}
                />
              </Field>
            </div>
            <p className="mt-2 text-xs text-gray-400">
              会自动生成 {form.propertyCode || "代号"}-01, {form.propertyCode || "代号"}-02... 房间，跟 CP01, CP02... 车位，之后再个别编辑房租/类型。留空 = 不自动加，之后自己去「房间」页面加。
            </p>
          </section>

          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? "建立中..." : "建立楼盘"}
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
