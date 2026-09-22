"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/components/Toast";
import { useT } from "@/components/LanguageProvider";

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
  const t = useT();
  const [form, setForm] = useState(emptyForm);
  const [dealType, setDealType] = useState<DealType>("OWN");
  const [submitting, setSubmitting] = useState(false);

  async function addProperty(e: FormEvent) {
    e.preventDefault();
    if (!form.propertyCode.trim()) {
      toast.warning(t("楼盘代号一定要填", "Property code is required"));
      return;
    }
    if (!form.name.trim()) {
      toast.warning(t("楼盘名字一定要填", "Property name is required"));
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
      toast.danger(t("系统出错，请稍后再试", "System error — please try again later"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-xl bg-white p-5 shadow-sm">
        <div className="mb-3.5 flex items-center justify-between">
          <h3 className="text-base font-semibold text-brand">{t("➕ 加新楼盘 (Unit)", "➕ Add Property (Unit)")}</h3>
          <Link href="/units" className="text-sm text-gray-500 hover:underline">
            {t("← 返回楼盘清单", "← Back to Property List")}
          </Link>
        </div>

        <form onSubmit={addProperty} className="space-y-5">
          <section>
            <h4 className="mb-2.5 text-sm font-semibold text-gray-500">{t("基本资料", "Basic Info")}</h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={t("楼盘代号 (Unit Code，例: MMB)", "Property Code (Unit Code, e.g. MMB)")}>
                <input
                  className="input uppercase"
                  value={form.propertyCode}
                  onChange={(e) => setForm({ ...form, propertyCode: e.target.value })}
                  placeholder={t("例: MMB", "e.g. MMB")}
                />
              </Field>
              <Field label={t("楼盘名字", "Property Name")}>
                <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
              <Field label={t("地址", "Address")}>
                <input
                  className="input"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </Field>
              <Field label={t("地区", "Region")}>
                <input className="input" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} />
              </Field>
            </div>
          </section>

          <section>
            <h4 className="mb-2.5 text-sm font-semibold text-gray-500">{t("楼盘性质", "Property Type")}</h4>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {(
                [
                  { v: "OWN", l: t("自己名下", "Self-owned") },
                  { v: "MANAGED", l: t("帮人管理 (收管理费%)", "Managed for Owner (% Management Fee)") },
                  { v: "MASTER_LEASE", l: t("跟 Owner 租 (付固定租金)", "Master Lease from Owner (Fixed Rent)") },
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
                <Field label={dealType === "MASTER_LEASE" ? t("Owner (业主)", "Owner") : "Landlord"}>
                  <input
                    className="input"
                    value={form.landlord}
                    onChange={(e) => setForm({ ...form, landlord: e.target.value })}
                  />
                </Field>
                {dealType === "MANAGED" ? (
                  <Field label={t("管理费 % (例10)", "Management Fee % (e.g. 10)")}>
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
                    <Field label={t("每月付 Owner 租金 RM", "Monthly Rent to Owner RM")}>
                      <input
                        type="number"
                        step="1"
                        className="input"
                        value={form.ownerRentalAmount}
                        onChange={(e) => setForm({ ...form, ownerRentalAmount: e.target.value })}
                      />
                    </Field>
                    <Field label={t("付 Owner 押金 RM (可退还)", "Deposit to Owner RM (Refundable)")}>
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
            <h4 className="mb-2.5 text-sm font-semibold text-gray-500">
              {t("自动加房间/车位 (选填)", "Auto-add Rooms/Parking (Optional)")}
            </h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={t("房间数量", "Room Count")}>
                <input
                  type="number"
                  min="0"
                  className="input"
                  placeholder={t("例: 4", "e.g. 4")}
                  value={form.roomCount}
                  onChange={(e) => setForm({ ...form, roomCount: e.target.value })}
                />
              </Field>
              <Field label={t("车位数量", "Parking Count")}>
                <input
                  type="number"
                  min="0"
                  className="input"
                  placeholder={t("例: 2", "e.g. 2")}
                  value={form.carparkCount}
                  onChange={(e) => setForm({ ...form, carparkCount: e.target.value })}
                />
              </Field>
            </div>
            <p className="mt-2 text-xs text-gray-400">
              {t(
                `会自动生成 ${form.propertyCode || "代号"}-01, ${form.propertyCode || "代号"}-02... 房间，跟 CP01, CP02... 车位，之后再个别编辑房租/类型。留空 = 不自动加，之后自己去「房间」页面加。`,
                `Will automatically generate rooms ${form.propertyCode || "CODE"}-01, ${form.propertyCode || "CODE"}-02... and parking CP01, CP02..., which you can then edit individually for rent/type. Leave blank = don't auto-add, add them later yourself on the "Rooms" page.`
              )}
            </p>
          </section>

          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? t("建立中...", "Creating...") : t("建立楼盘", "Create Property")}
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
