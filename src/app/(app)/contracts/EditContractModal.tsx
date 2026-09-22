"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { useT } from "@/components/LanguageProvider";
import { monthsBetween, endDateFromTenure } from "@/lib/tenure";

function dv(v: unknown) {
  return v ? String(v).slice(0, 10) : "";
}

export default function EditContractModal({
  contractCode,
  onClose,
  onSaved,
}: {
  contractCode: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const t = useT();
  const [form, setForm] = useState<Record<string, string> | null>(null);
  const [utils, setUtils] = useState({ electric: false, aircond: false, dryer: false });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [vacantCarparks, setVacantCarparks] = useState<{ roomCode: string; propertyName: string }[]>([]);

  useEffect(() => {
    Promise.all([
      fetch(`/api/contracts/${contractCode}`).then((r) => r.json()),
      fetch("/api/contracts/page-data").then((r) => r.json()),
    ]).then(([data, pageData]) => {
      if (!data.success) {
        setMessage(data.message);
        return;
      }
      const c = data.contract;
      setForm({
        tenantName: c.tenantName || "",
        tenantIc: c.tenantIc || "",
        moveInDate: dv(c.moveInDate),
        commencementDate: dv(c.commencementDate),
        expiredDate: dv(c.expiredDate),
        tenureMonths: c.tenureMonths ? String(c.tenureMonths) : "",
        roomRental: String(c.roomRental ?? 0),
        carparkRental: String(c.carparkRental ?? 0),
        carparkRoomCode: c.carparkRoom?.roomCode || "",
        securityDeposit: String(c.securityDeposit ?? 0),
        utilitiesDeposit: String(c.utilitiesDeposit ?? 0),
        accessCardDeposit: String(c.accessCardDeposit ?? 0),
        adminFee: String(c.adminFee ?? 0),
        remarks: c.remarks || "",
        nationality: c.nationality || "",
        contactNumber: c.contactNumber || "",
        email: c.email || "",
        occupation: c.occupation || "",
        company: c.company || "",
        carPlate: c.carPlate || "",
        emergencyName: c.emergencyName || "",
        emergencyContact: c.emergencyContact || "",
        emergencyRelationship: c.emergencyRelationship || "",
        commAmount: c.commAmount != null ? String(c.commAmount) : "",
        commStatus: c.commStatus === "Paid" ? "Paid" : "Pending",
      });
      setUtils({ electric: !!c.utilElectric, aircond: !!c.utilAircond, dryer: !!c.utilDryer });

      const carparks: { roomCode: string; propertyName: string }[] = pageData.success ? pageData.vacantCarparks : [];
      // The contract's own already-assigned carpark isn't globally "vacant" anymore, but it
      // still needs to appear in the dropdown so Admin can see/keep the current selection.
      if (c.carparkRoom && !carparks.some((r) => r.roomCode === c.carparkRoom.roomCode)) {
        carparks.push({ roomCode: c.carparkRoom.roomCode, propertyName: c.carparkRoom.propertyName });
      }
      setVacantCarparks(carparks);
    });
  }, [contractCode]);

  function set(key: string, value: string) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  function onDateChange(field: "commencementDate" | "expiredDate" | "tenureMonths", value: string) {
    if (!form) return;
    const next = { ...form, [field]: value };
    if (next.commencementDate && next.expiredDate && field !== "tenureMonths") {
      const m = monthsBetween(next.commencementDate, next.expiredDate);
      if (m > 0) next.tenureMonths = String(m);
    } else if (next.commencementDate && next.tenureMonths && (field === "tenureMonths" || !next.expiredDate)) {
      next.expiredDate = endDateFromTenure(next.commencementDate, parseInt(next.tenureMonths, 10));
    }
    setForm(next);
  }

  async function save() {
    if (!form) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/contracts/${contractCode}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          utilElectric: utils.electric,
          utilAircond: utils.aircond,
          utilDryer: utils.dryer,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setTimeout(() => {
          onSaved();
          onClose();
        }, 800);
      } else {
        toast.danger(data.message);
      }
    } catch {
      toast.danger(t("系统出错，请稍后再试", "System error — please try again later"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal onClose={onClose} wide>
      <h3 className="text-lg font-bold text-brand">✏️ {t("编辑合同", "Edit Contract")} {contractCode}</h3>
      {!form && <div className="mt-3 text-sm text-gray-500">{message || t("载入中...", "Loading...")}</div>}
      {form && (
        <div className="mt-3.5 space-y-2.5">
          <Row>
            <Field label={t("租客姓名", "Tenant Name")}>
              <input className="input" value={form.tenantName} onChange={(e) => set("tenantName", e.target.value)} />
            </Field>
            <Field label={t("租客 IC", "Tenant IC")}>
              <input className="input" value={form.tenantIc} onChange={(e) => set("tenantIc", e.target.value)} />
            </Field>
            <Field label="Email">
              <input className="input" value={form.email} onChange={(e) => set("email", e.target.value)} />
            </Field>
          </Row>
          <Row>
            <Field label="Move-in">
              <input type="date" className="input" value={form.moveInDate} onChange={(e) => set("moveInDate", e.target.value)} />
            </Field>
            <Field label={t("开始日", "Start Date")}>
              <input
                type="date"
                className="input"
                value={form.commencementDate}
                onChange={(e) => onDateChange("commencementDate", e.target.value)}
              />
            </Field>
            <Field label={t("到期日", "Expiry Date")}>
              <input
                type="date"
                className="input"
                value={form.expiredDate}
                onChange={(e) => onDateChange("expiredDate", e.target.value)}
              />
            </Field>
            <Field label={t("租期(月)", "Tenure (months)")}>
              <input
                type="number"
                className="input"
                value={form.tenureMonths}
                onChange={(e) => onDateChange("tenureMonths", e.target.value)}
              />
            </Field>
          </Row>
          <Row>
            <Field label={t("房租 RM", "Rent RM")}>
              <input type="number" className="input" value={form.roomRental} onChange={(e) => set("roomRental", e.target.value)} />
            </Field>
            <Field label={t("车位 RM", "Carpark RM")}>
              <input type="number" className="input" value={form.carparkRental} onChange={(e) => set("carparkRental", e.target.value)} />
            </Field>
            <Field label={t("选车位 (可选)", "Select Carpark (optional)")}>
              <select className="input" value={form.carparkRoomCode} onChange={(e) => set("carparkRoomCode", e.target.value)}>
                <option value="">-- {t("没有车位", "No Carpark")} --</option>
                {vacantCarparks.map((r) => (
                  <option key={r.roomCode} value={r.roomCode}>
                    {r.roomCode} ({r.propertyName})
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("押金 Security", "Security Deposit")}>
              <input type="number" className="input" value={form.securityDeposit} onChange={(e) => set("securityDeposit", e.target.value)} />
            </Field>
            <Field label={t("水电押", "Utilities Deposit")}>
              <input type="number" className="input" value={form.utilitiesDeposit} onChange={(e) => set("utilitiesDeposit", e.target.value)} />
            </Field>
          </Row>
          <Row>
            <Field label={t("门卡押 RM", "Access Card Deposit RM")}>
              <input type="number" className="input" value={form.accessCardDeposit} onChange={(e) => set("accessCardDeposit", e.target.value)} />
            </Field>
            <Field label="Admin Fee RM">
              <input type="number" className="input" value={form.adminFee} onChange={(e) => set("adminFee", e.target.value)} />
            </Field>
            <Field label={t("备注", "Remarks")} wide>
              <input className="input" value={form.remarks} onChange={(e) => set("remarks", e.target.value)} />
            </Field>
          </Row>

          <div className="pt-1 text-sm font-semibold text-brand">👤 {t("个人资料", "Personal Information")}</div>
          <Row>
            <Field label={t("国籍", "Nationality")}>
              <input className="input" value={form.nationality} onChange={(e) => set("nationality", e.target.value)} />
            </Field>
            <Field label={t("电话", "Phone")}>
              <input className="input" value={form.contactNumber} onChange={(e) => set("contactNumber", e.target.value)} />
            </Field>
            <Field label={t("职业", "Occupation")}>
              <input className="input" value={form.occupation} onChange={(e) => set("occupation", e.target.value)} />
            </Field>
            <Field label={t("公司/大学", "Company/University")}>
              <input className="input" value={form.company} onChange={(e) => set("company", e.target.value)} />
            </Field>
          </Row>
          <Row>
            <Field label={t("车牌", "Car Plate")}>
              <input className="input" value={form.carPlate} onChange={(e) => set("carPlate", e.target.value)} />
            </Field>
            <Field label={t("紧急联络人", "Emergency Contact Name")}>
              <input className="input" value={form.emergencyName} onChange={(e) => set("emergencyName", e.target.value)} />
            </Field>
            <Field label={t("紧急电话", "Emergency Phone")}>
              <input className="input" value={form.emergencyContact} onChange={(e) => set("emergencyContact", e.target.value)} />
            </Field>
            <Field label={t("关系", "Relationship")}>
              <input
                className="input"
                value={form.emergencyRelationship}
                onChange={(e) => set("emergencyRelationship", e.target.value)}
              />
            </Field>
          </Row>

          <div className="pt-1 text-sm font-semibold text-brand">💰 {t("佣金", "Commission")}</div>
          <Row>
            <Field label={t("佣金金额 RM", "Commission Amount RM")}>
              <input
                type="number"
                className="input"
                value={form.commAmount}
                onChange={(e) => set("commAmount", e.target.value)}
              />
            </Field>
            <Field label={t("发放状态", "Payout Status")}>
              <select className="input" value={form.commStatus} onChange={(e) => set("commStatus", e.target.value)}>
                <option value="Pending">{t("待发", "Pending")}</option>
                <option value="Paid">{t("已发", "Paid")}</option>
              </select>
            </Field>
          </Row>

          <div className="flex gap-4 pt-1 text-sm">
            <label className="flex cursor-pointer items-center gap-1.5">
              <input type="checkbox" checked={utils.electric} onChange={(e) => setUtils({ ...utils, electric: e.target.checked })} />
              Electricity
            </label>
            <label className="flex cursor-pointer items-center gap-1.5">
              <input type="checkbox" checked={utils.aircond} onChange={(e) => setUtils({ ...utils, aircond: e.target.checked })} />
              Air-Cond
            </label>
            <label className="flex cursor-pointer items-center gap-1.5">
              <input type="checkbox" checked={utils.dryer} onChange={(e) => setUtils({ ...utils, dryer: e.target.checked })} />
              Dryer
            </label>
          </div>

          <button onClick={save} disabled={loading} className="btn-primary">
            {t("保存修改", "Save Changes")}
          </button>
        </div>
      )}
    </Modal>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-2.5">{children}</div>;
}
function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`min-w-[150px] ${wide ? "flex-[2]" : "flex-1"}`}>
      <label className="mb-1.5 block text-sm text-gray-600">{label}</label>
      {children}
    </div>
  );
}
