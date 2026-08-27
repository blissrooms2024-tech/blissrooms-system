"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import { useToast } from "@/components/Toast";

export interface EditableProperty {
  propertyCode: string;
  name: string;
  address: string | null;
  region: string | null;
  landlord: string | null;
  managementFeeRate: number | null;
  status: string | null;
  notes: string | null;
}

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
  const [name, setName] = useState(property.name);
  const [address, setAddress] = useState(property.address ?? "");
  const [region, setRegion] = useState(property.region ?? "");
  const [landlord, setLandlord] = useState(property.landlord ?? "");
  const [managementFeeRate, setManagementFeeRate] = useState(
    property.managementFeeRate ? String(property.managementFeeRate * 100) : ""
  );
  const [status, setStatus] = useState(property.status ?? "Active");
  const [notes, setNotes] = useState(property.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) {
      toast.warning("楼盘名字一定要填");
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
          landlord,
          managementFeeRate: managementFeeRate ? Number(managementFeeRate) / 100 : undefined,
          status,
          notes,
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
      toast.danger("系统出错，请稍后再试");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <h3 className="mb-3.5 text-lg font-bold text-brand">✏️ 编辑楼盘 — {property.propertyCode}</h3>
      <div className="space-y-3">
        <div>
          <label className="mb-1.5 block text-sm text-gray-600">楼盘名字</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="input" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-gray-600">地址</label>
          <input value={address} onChange={(e) => setAddress(e.target.value)} className="input" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-gray-600">地区</label>
          <input value={region} onChange={(e) => setRegion(e.target.value)} className="input" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-gray-600">Landlord (帮人管理才填)</label>
          <input
            value={landlord}
            onChange={(e) => setLandlord(e.target.value)}
            className="input"
            placeholder="留空 = 自己名下"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-gray-600">管理费 % (例10)</label>
          <input
            type="number"
            step="0.1"
            value={managementFeeRate}
            onChange={(e) => setManagementFeeRate(e.target.value)}
            className="input"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-gray-600">状态</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="input">
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-gray-600">备注 Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="input" />
        </div>
        <button onClick={save} disabled={saving} className="btn-primary w-full">
          {saving ? "保存中..." : "保存"}
        </button>
      </div>
    </Modal>
  );
}
