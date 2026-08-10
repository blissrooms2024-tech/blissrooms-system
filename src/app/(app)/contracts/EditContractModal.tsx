"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/Modal";
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
  const [form, setForm] = useState<Record<string, string> | null>(null);
  const [utils, setUtils] = useState({ electric: false, aircond: false, dryer: false });
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/contracts/${contractCode}`)
      .then((r) => r.json())
      .then((data) => {
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
        });
        setUtils({ electric: !!c.utilElectric, aircond: !!c.utilAircond, dryer: !!c.utilDryer });
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
      setOk(!!data.success);
      setMessage(data.message);
      if (data.success) {
        setTimeout(() => {
          onSaved();
          onClose();
        }, 800);
      }
    } catch {
      setMessage("系统出错，请稍后再试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal onClose={onClose} wide>
      <h3 className="text-lg font-bold text-brand">✏️ 编辑合同 {contractCode}</h3>
      {!form && <div className="mt-3 text-sm text-gray-500">{message || "载入中..."}</div>}
      {form && (
        <div className="mt-3.5 space-y-2.5">
          <Row>
            <Field label="租客姓名">
              <input className="input" value={form.tenantName} onChange={(e) => set("tenantName", e.target.value)} />
            </Field>
            <Field label="租客 IC">
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
            <Field label="开始日">
              <input
                type="date"
                className="input"
                value={form.commencementDate}
                onChange={(e) => onDateChange("commencementDate", e.target.value)}
              />
            </Field>
            <Field label="到期日">
              <input
                type="date"
                className="input"
                value={form.expiredDate}
                onChange={(e) => onDateChange("expiredDate", e.target.value)}
              />
            </Field>
            <Field label="租期(月)">
              <input
                type="number"
                className="input"
                value={form.tenureMonths}
                onChange={(e) => onDateChange("tenureMonths", e.target.value)}
              />
            </Field>
          </Row>
          <Row>
            <Field label="房租 RM">
              <input type="number" className="input" value={form.roomRental} onChange={(e) => set("roomRental", e.target.value)} />
            </Field>
            <Field label="车位 RM">
              <input type="number" className="input" value={form.carparkRental} onChange={(e) => set("carparkRental", e.target.value)} />
            </Field>
            <Field label="押金 Security">
              <input type="number" className="input" value={form.securityDeposit} onChange={(e) => set("securityDeposit", e.target.value)} />
            </Field>
            <Field label="水电押">
              <input type="number" className="input" value={form.utilitiesDeposit} onChange={(e) => set("utilitiesDeposit", e.target.value)} />
            </Field>
          </Row>
          <Row>
            <Field label="门卡押 RM">
              <input type="number" className="input" value={form.accessCardDeposit} onChange={(e) => set("accessCardDeposit", e.target.value)} />
            </Field>
            <Field label="Admin Fee RM">
              <input type="number" className="input" value={form.adminFee} onChange={(e) => set("adminFee", e.target.value)} />
            </Field>
            <Field label="备注" wide>
              <input className="input" value={form.remarks} onChange={(e) => set("remarks", e.target.value)} />
            </Field>
          </Row>

          <div className="pt-1 text-sm font-semibold text-brand">👤 个人资料</div>
          <Row>
            <Field label="国籍">
              <input className="input" value={form.nationality} onChange={(e) => set("nationality", e.target.value)} />
            </Field>
            <Field label="电话">
              <input className="input" value={form.contactNumber} onChange={(e) => set("contactNumber", e.target.value)} />
            </Field>
            <Field label="职业">
              <input className="input" value={form.occupation} onChange={(e) => set("occupation", e.target.value)} />
            </Field>
            <Field label="公司/大学">
              <input className="input" value={form.company} onChange={(e) => set("company", e.target.value)} />
            </Field>
          </Row>
          <Row>
            <Field label="车牌">
              <input className="input" value={form.carPlate} onChange={(e) => set("carPlate", e.target.value)} />
            </Field>
            <Field label="紧急联络人">
              <input className="input" value={form.emergencyName} onChange={(e) => set("emergencyName", e.target.value)} />
            </Field>
            <Field label="紧急电话">
              <input className="input" value={form.emergencyContact} onChange={(e) => set("emergencyContact", e.target.value)} />
            </Field>
            <Field label="关系">
              <input
                className="input"
                value={form.emergencyRelationship}
                onChange={(e) => set("emergencyRelationship", e.target.value)}
              />
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
            保存修改
          </button>
          {message && <div className={`text-sm ${ok ? "text-green-700" : "text-red-600"}`}>{message}</div>}
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
