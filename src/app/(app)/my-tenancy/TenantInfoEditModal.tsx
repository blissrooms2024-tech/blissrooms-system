"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { useT } from "@/components/LanguageProvider";

export interface EditableTenantInfo {
  nationality: string | null;
  contactNumber: string | null;
  email: string | null;
  occupation: string | null;
  company: string | null;
  carPlate: string | null;
  emergencyName: string | null;
  emergencyContact: string | null;
  emergencyRelationship: string | null;
}

export default function TenantInfoEditModal({
  contractCode,
  info,
  onClose,
  onSaved,
}: {
  contractCode: string;
  info: EditableTenantInfo;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const t = useT();
  const [nationality, setNationality] = useState(info.nationality ?? "");
  const [contactNumber, setContactNumber] = useState(info.contactNumber ?? "");
  const [email, setEmail] = useState(info.email ?? "");
  const [occupation, setOccupation] = useState(info.occupation ?? "");
  const [company, setCompany] = useState(info.company ?? "");
  const [carPlate, setCarPlate] = useState(info.carPlate ?? "");
  const [emergencyName, setEmergencyName] = useState(info.emergencyName ?? "");
  const [emergencyContact, setEmergencyContact] = useState(info.emergencyContact ?? "");
  const [emergencyRelationship, setEmergencyRelationship] = useState(info.emergencyRelationship ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/contracts/${contractCode}/tenant-info`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nationality,
          contactNumber,
          email,
          occupation,
          company,
          carPlate,
          emergencyName,
          emergencyContact,
          emergencyRelationship,
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
      <h3 className="mb-3.5 text-lg font-bold text-brand">{t("✏️ 编辑我的资料", "✏️ Edit My Info")}</h3>
      <p className="mb-3.5 text-xs text-gray-400">
        {t(
          "如果 Admin 帮你 keyin 的资料有打错或漏了，可以在这里自己更正。房租、押金、租期等资料如需更改请联系 Admin。",
          "If anything Admin keyed in for you was mistyped or missing, you can correct it here yourself. To change rent, deposit, tenure etc., please contact Admin."
        )}
      </p>
      <div className="space-y-3">
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="mb-1.5 block text-sm text-gray-600">{t("国籍 Nationality", "Nationality")}</label>
            <input value={nationality} onChange={(e) => setNationality(e.target.value)} className="input" />
          </div>
          <div className="flex-1">
            <label className="mb-1.5 block text-sm text-gray-600">{t("电话 Contact", "Contact")}</label>
            <input value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} className="input" />
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-gray-600">Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="mb-1.5 block text-sm text-gray-600">{t("职业 Occupation", "Occupation")}</label>
            <input value={occupation} onChange={(e) => setOccupation(e.target.value)} className="input" />
          </div>
          <div className="flex-1">
            <label className="mb-1.5 block text-sm text-gray-600">{t("公司/大学 Company", "Company")}</label>
            <input value={company} onChange={(e) => setCompany(e.target.value)} className="input" />
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-gray-600">{t("车牌 Car Plate", "Car Plate")}</label>
          <input value={carPlate} onChange={(e) => setCarPlate(e.target.value)} className="input" />
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="mb-1.5 block text-sm text-gray-600">{t("紧急联络人", "Emergency Contact Name")}</label>
            <input value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)} className="input" />
          </div>
          <div className="flex-1">
            <label className="mb-1.5 block text-sm text-gray-600">{t("紧急电话", "Emergency Phone")}</label>
            <input value={emergencyContact} onChange={(e) => setEmergencyContact(e.target.value)} className="input" />
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-gray-600">{t("关系 Relationship", "Relationship")}</label>
          <input
            value={emergencyRelationship}
            onChange={(e) => setEmergencyRelationship(e.target.value)}
            className="input"
          />
        </div>
        <button onClick={save} disabled={saving} className="btn-primary w-full">
          {saving ? t("保存中...", "Saving...") : t("保存", "Save")}
        </button>
      </div>
    </Modal>
  );
}
