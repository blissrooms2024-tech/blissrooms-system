"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { useT } from "@/components/LanguageProvider";

export interface EditableProperty {
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
  roomCount: number;
  carparkCount: number;
}

type DealType = "OWN" | "MANAGED" | "MASTER_LEASE";

export default function PropertyEditModal({
  property,
  onClose,
  onSaved,
}: {
  property: EditableProperty;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const t = useT();
  const [name, setName] = useState(property.name);
  const [address, setAddress] = useState(property.address ?? "");
  const [region, setRegion] = useState(property.region ?? "");
  const [landlord, setLandlord] = useState(property.landlord ?? "");
  const [managementFeeRate, setManagementFeeRate] = useState(
    property.managementFeeRate ? String(property.managementFeeRate * 100) : ""
  );
  const [ownerRentalAmount, setOwnerRentalAmount] = useState(
    property.ownerRentalAmount !== null ? String(property.ownerRentalAmount) : ""
  );
  const [ownerDeposit, setOwnerDeposit] = useState(
    property.ownerDeposit !== null ? String(property.ownerDeposit) : ""
  );
  const [dealType, setDealType] = useState<DealType>(
    property.ownerRentalAmount !== null ? "MASTER_LEASE" : property.managementFeeRate ? "MANAGED" : "OWN"
  );
  const [status, setStatus] = useState(property.status ?? "Active");
  const [notes, setNotes] = useState(property.notes ?? "");
  const [roomCount, setRoomCount] = useState(String(property.roomCount));
  const [carparkCount, setCarparkCount] = useState(String(property.carparkCount));
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) {
      toast.warning(t("楼盘名字一定要填", "Property name is required"));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/properties/${property.propertyCode}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          address,
          region,
          landlord: dealType === "OWN" ? "" : landlord,
          managementFeeRate: dealType === "MANAGED" && managementFeeRate ? Number(managementFeeRate) / 100 : undefined,
          ownerRentalAmount: dealType === "MASTER_LEASE" && ownerRentalAmount ? Number(ownerRentalAmount) : undefined,
          ownerDeposit: dealType === "MASTER_LEASE" && ownerDeposit ? Number(ownerDeposit) : undefined,
          status,
          notes,
          roomCount: Number(roomCount) || 0,
          carparkCount: Number(carparkCount) || 0,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        onSaved();
        onClose();
      } else {
        toast.danger(data.message);
      }
    } catch {
      toast.danger(t("系统出错，请稍后再试", "System error — please try again later"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <h3 className="mb-3.5 text-lg font-bold text-brand">
        {t("✏️ 编辑楼盘", "✏️ Edit Property")} — {property.propertyCode}
      </h3>
      <div className="space-y-3">
        <div>
          <label className="mb-1.5 block text-sm text-gray-600">{t("楼盘名字", "Property Name")}</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="input" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-gray-600">{t("地址", "Address")}</label>
          <input value={address} onChange={(e) => setAddress(e.target.value)} className="input" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-gray-600">{t("地区", "Region")}</label>
          <input value={region} onChange={(e) => setRegion(e.target.value)} className="input" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-gray-600">{t("楼盘性质", "Property Type")}</label>
          <div className="grid grid-cols-1 gap-2">
            {(
              [
                { v: "OWN", l: t("自己名下", "Self-owned") },
                { v: "MANAGED", l: t("帮人管理 (收管理费%)", "Managed for Owner (% Management Fee)") },
                { v: "MASTER_LEASE", l: t("跟 Owner 租 (付固定租金)", "Master Lease from Owner (Fixed Rent)") },
              ] as { v: DealType; l: string }[]
            ).map((opt) => (
              <label
                key={opt.v}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                  dealType === opt.v ? "border-brand bg-brand-light/40 font-semibold text-brand" : "border-gray-200 text-gray-600"
                }`}
              >
                <input type="radio" name="dealType" checked={dealType === opt.v} onChange={() => setDealType(opt.v)} />
                {opt.l}
              </label>
            ))}
          </div>
        </div>
        {dealType !== "OWN" && (
          <>
            <div>
              <label className="mb-1.5 block text-sm text-gray-600">
                {dealType === "MASTER_LEASE" ? t("Owner (业主)", "Owner") : "Landlord"}
              </label>
              <input value={landlord} onChange={(e) => setLandlord(e.target.value)} className="input" />
            </div>
            {dealType === "MANAGED" ? (
              <div>
                <label className="mb-1.5 block text-sm text-gray-600">{t("管理费 % (例10)", "Management Fee % (e.g. 10)")}</label>
                <input
                  type="number"
                  step="0.1"
                  value={managementFeeRate}
                  onChange={(e) => setManagementFeeRate(e.target.value)}
                  className="input"
                />
              </div>
            ) : (
              <>
                <div>
                  <label className="mb-1.5 block text-sm text-gray-600">{t("每月付 Owner 租金 RM", "Monthly Rent to Owner RM")}</label>
                  <input
                    type="number"
                    step="1"
                    value={ownerRentalAmount}
                    onChange={(e) => setOwnerRentalAmount(e.target.value)}
                    className="input"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm text-gray-600">
                    {t("付 Owner 押金 RM (可退还)", "Deposit to Owner RM (Refundable)")}
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={ownerDeposit}
                    onChange={(e) => setOwnerDeposit(e.target.value)}
                    className="input"
                  />
                </div>
              </>
            )}
          </>
        )}
        <div>
          <label className="mb-1.5 block text-sm text-gray-600">{t("状态", "Status")}</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="input">
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-gray-600">{t("备注 Notes", "Notes")}</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="input" />
        </div>
        <div className="flex gap-3 rounded-lg bg-gray-50 p-3">
          <div className="flex-1">
            <label className="mb-1.5 block text-sm text-gray-600">{t("房间数量", "Room Count")}</label>
            <input
              type="number"
              min="0"
              value={roomCount}
              onChange={(e) => setRoomCount(e.target.value)}
              className="input"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1.5 block text-sm text-gray-600">{t("车位数量", "Parking Count")}</label>
            <input
              type="number"
              min="0"
              value={carparkCount}
              onChange={(e) => setCarparkCount(e.target.value)}
              className="input"
            />
          </div>
        </div>
        <p className="-mt-2 text-xs text-gray-400">
          {t(
            "数字改大了保存后，会自动加新的房间/车位，接着现有的编号继续；改小不会删除现有房间",
            "Increasing the number and saving will automatically add new rooms/parking, continuing from the existing numbering; decreasing it will not delete existing rooms"
          )}
        </p>
        <button onClick={save} disabled={saving} className="btn-primary w-full">
          {saving ? t("保存中...", "Saving...") : t("保存", "Save")}
        </button>
      </div>
    </Modal>
  );
}
