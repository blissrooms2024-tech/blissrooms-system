"use client";

import { useState, FormEvent } from "react";
import { monthsBetween, endDateFromTenure } from "@/lib/tenure";

interface VacantRoom {
  roomCode: string;
  propertyName: string;
}
interface Agent {
  userCode: string;
  name: string;
}

const initialForm = {
  roomCode: "",
  agentId: "",
  tenantName: "",
  tenantIc: "",
  moveInDate: "",
  commencementDate: "",
  expiredDate: "",
  tenureMonths: "",
  roomRental: "",
  carparkRental: "0",
  securityDeposit: "",
  utilitiesDeposit: "",
  accessCardDeposit: "0",
  adminFee: "",
  remarks: "",
  nationality: "",
  contactNumber: "",
  email: "",
  occupation: "",
  company: "",
  carPlate: "",
  emergencyName: "",
  emergencyContact: "",
  emergencyRelationship: "",
};

export default function ContractForm({
  role,
  vacantRooms,
  agents,
  onCreated,
}: {
  role: string;
  vacantRooms: VacantRoom[];
  agents: Agent[];
  onCreated: () => void;
}) {
  const [form, setForm] = useState(initialForm);
  const [utils, setUtils] = useState({ electric: false, aircond: false, dryer: false });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  function set<K extends keyof typeof initialForm>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function onDateChange(field: "commencementDate" | "expiredDate" | "tenureMonths", value: string) {
    const next = { ...form, [field]: value };
    if (next.commencementDate && next.expiredDate && field !== "tenureMonths") {
      const m = monthsBetween(next.commencementDate, next.expiredDate);
      if (m > 0) next.tenureMonths = String(m);
    } else if (next.commencementDate && next.tenureMonths && (field === "tenureMonths" || !next.expiredDate)) {
      next.expiredDate = endDateFromTenure(next.commencementDate, parseInt(next.tenureMonths, 10));
    }
    setForm(next);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!form.roomCode || !form.tenantName) {
      setMessage("房间和租客姓名一定要填");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          utilElectric: utils.electric,
          utilAircond: utils.aircond,
          utilDryer: utils.dryer,
        }),
      });
      const data = await res.json();
      setMessage(data.message);
      if (data.success) {
        setForm(initialForm);
        setUtils({ electric: false, aircond: false, dryer: false });
        onCreated();
      }
    } catch {
      setMessage("系统出错，请稍后再试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl bg-white p-5 shadow-sm">
      <h3 className="mb-3.5 text-base font-semibold text-brand">📝 开新合同</h3>
      <form onSubmit={submit} className="space-y-2.5">
        <Row>
          <Field label="选空房">
            <select className="input" value={form.roomCode} onChange={(e) => set("roomCode", e.target.value)}>
              <option value="">-- 选房间 --</option>
              {vacantRooms.map((r) => (
                <option key={r.roomCode} value={r.roomCode}>
                  {r.roomCode} ({r.propertyName})
                </option>
              ))}
            </select>
          </Field>
          {role === "ADMIN" && (
            <Field label="负责 Agent">
              <select className="input" value={form.agentId} onChange={(e) => set("agentId", e.target.value)}>
                <option value="">-- 选 Agent --</option>
                {agents.map((a) => (
                  <option key={a.userCode} value={a.userCode}>
                    {a.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label="租客姓名">
            <input className="input" value={form.tenantName} onChange={(e) => set("tenantName", e.target.value)} />
          </Field>
          <Field label="租客 IC">
            <input className="input" value={form.tenantIc} onChange={(e) => set("tenantIc", e.target.value)} />
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
          <Field label="水电押 Utilities">
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

        <div className="pt-2 text-sm font-semibold text-brand">👤 租客个人资料</div>
        <Row>
          <Field label="国籍 Nationality">
            <input className="input" value={form.nationality} onChange={(e) => set("nationality", e.target.value)} />
          </Field>
          <Field label="电话 Contact">
            <input className="input" value={form.contactNumber} onChange={(e) => set("contactNumber", e.target.value)} />
          </Field>
          <Field label="Email">
            <input type="email" className="input" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </Field>
          <Field label="职业 Occupation">
            <input className="input" value={form.occupation} onChange={(e) => set("occupation", e.target.value)} />
          </Field>
        </Row>
        <Row>
          <Field label="公司/大学 Company">
            <input className="input" value={form.company} onChange={(e) => set("company", e.target.value)} />
          </Field>
          <Field label="车牌 Car Plate">
            <input className="input" value={form.carPlate} onChange={(e) => set("carPlate", e.target.value)} />
          </Field>
          <Field label="紧急联络人">
            <input className="input" value={form.emergencyName} onChange={(e) => set("emergencyName", e.target.value)} />
          </Field>
          <Field label="紧急电话">
            <input className="input" value={form.emergencyContact} onChange={(e) => set("emergencyContact", e.target.value)} />
          </Field>
        </Row>
        <Row>
          <Field label="关系 Relationship">
            <input
              className="input"
              value={form.emergencyRelationship}
              onChange={(e) => set("emergencyRelationship", e.target.value)}
            />
          </Field>
        </Row>

        <div className="pt-2 text-sm font-semibold text-brand">⚡ 适用水电项目 (勾了才写进合同)</div>
        <div className="flex flex-col gap-2 pt-1">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={utils.electric}
              onChange={(e) => setUtils({ ...utils, electric: e.target.checked })}
            />
            Electricity Usage 电费 (RM0.50/kWh)
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={utils.aircond}
              onChange={(e) => setUtils({ ...utils, aircond: e.target.checked })}
            />
            Air-Conditioner Usage 冷气 (RM0.75/kWh)
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={utils.dryer}
              onChange={(e) => setUtils({ ...utils, dryer: e.target.checked })}
            />
            Dryer Usage 烘干机 (RM0.50/kWh)
          </label>
        </div>

        <div className="pt-3 text-right">
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? "建立中..." : "建立合同"}
          </button>
        </div>
        {message && <div className="text-sm text-gray-600">{message}</div>}
      </form>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-2.5">{children}</div>;
}
function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return <div className={`min-w-[150px] ${wide ? "flex-[2]" : "flex-1"}`}>
    <label className="mb-1.5 block text-sm text-gray-600">{label}</label>
    {children}
  </div>;
}
