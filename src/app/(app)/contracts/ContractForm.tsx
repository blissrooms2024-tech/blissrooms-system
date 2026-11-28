"use client";

import { useCallback, useMemo, useState, FormEvent } from "react";
import { monthsBetween, endDateFromTenure } from "@/lib/tenure";
import { useToast } from "@/components/Toast";
import { useT } from "@/components/LanguageProvider";
import TenantPicker, { TenantOption } from "./TenantPicker";
import UnitRoomSelect, { EMPTY_PICK, roomLabel, useUnitTree, type PickRoom, type UnitRoomValue } from "@/components/UnitRoomSelect";

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
  carparkRoomCode: "",
  agentId: "",
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
  prorataAmount: "",
  prorataDueDate: "",
  remarks: "",
  // Not agent-editable here — nationality/occupation/company/carPlate/emergency contact are
  // secondary personal info the tenant fills in themselves after signup (my-tenancy → 个人资料),
  // same as bank details (我的资料). contactNumber/email are still silently pre-filled from the
  // tenant's account below so they're not lost, just no longer shown as agent input fields.
  contactNumber: "",
  email: "",
};

export default function ContractForm({
  role,
  vacantRooms,
  vacantCarparks,
  agents,
  onCreated,
}: {
  role: string;
  vacantRooms: VacantRoom[];
  vacantCarparks: VacantRoom[];
  agents: Agent[];
  onCreated: () => void;
}) {
  const toast = useToast();
  const t = useT();
  const [form, setForm] = useState(initialForm);
  // 楼盘 → 单位号码 → 空房; the room chosen is form.roomCode.
  const tree = useUnitTree();
  const [roomPick, setRoomPick] = useState<UnitRoomValue>(EMPTY_PICK);
  const vacantSet = useMemo(() => new Set(vacantRooms.map((r) => r.roomCode)), [vacantRooms]);
  const isVacant = useCallback((r: PickRoom) => vacantSet.has(r.roomCode), [vacantSet]);
  const [tenant, setTenant] = useState<TenantOption | null>(null);
  const [utils, setUtils] = useState({ electric: false, aircond: false, dryer: false });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ roomCode?: boolean; tenant?: boolean }>({});

  function selectTenant(t: TenantOption | null) {
    setTenant(t);
    if (t) setErrors((e) => ({ ...e, tenant: false }));
    if (t) {
      setForm((f) => ({
        ...f,
        email: f.email || t.email,
        contactNumber: f.contactNumber || t.phone || "",
      }));
    }
  }

  function set<K extends keyof typeof initialForm>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    if (key === "roomCode" && value) setErrors((e) => ({ ...e, roomCode: false }));
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
    if (!form.roomCode || !tenant) {
      setErrors({ roomCode: !form.roomCode, tenant: !tenant });
      toast.warning(t("房间和租客一定要选", "Room and tenant are both required"));
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          tenantCode: tenant.userCode,
          utilElectric: utils.electric,
          utilAircond: utils.aircond,
          utilDryer: utils.dryer,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setForm(initialForm);
        setRoomPick(EMPTY_PICK);
        setTenant(null);
        setUtils({ electric: false, aircond: false, dryer: false });
        onCreated();
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
    <div className="rounded-xl bg-white p-5 shadow-sm">
      <h3 className="mb-3.5 text-base font-semibold text-brand">📝 {t("开新合同", "New Contract")}</h3>
      <form onSubmit={submit} className="space-y-2.5">
        <UnitRoomSelect
          units={tree ?? []}
          value={roomPick}
          onChange={(v) => {
            setRoomPick(v);
            set("roomCode", v.room);
          }}
          rooms="required"
          roomFilter={isVacant}
          hideEmpty
          invalid={!!errors.roomCode}
          roomLabelText={t("空房", "Vacant room")}
          roomText={(r, u) => `${roomLabel(r.roomCode, u.propertyCode)}${r.isCarpark ? ` · ${t("车位", "carpark")}` : ""}`}
        />
        <Row>
          {role === "ADMIN" && (
            <Field label={t("负责 Agent", "Assigned Agent")}>
              <select className="input" value={form.agentId} onChange={(e) => set("agentId", e.target.value)}>
                <option value="">-- {t("选 Agent", "Select Agent")} --</option>
                {agents.map((a) => (
                  <option key={a.userCode} value={a.userCode}>
                    {a.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label={t("租客", "Tenant")} wide>
            <TenantPicker value={tenant} onChange={selectTenant} error={errors.tenant} />
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
          <Field label={t("选车位 (可选，免费也可以选)", "Select Carpark (optional, can be free)")}>
            <select className="input" value={form.carparkRoomCode} onChange={(e) => set("carparkRoomCode", e.target.value)}>
              <option value="">-- {t("没有车位", "No Carpark")} --</option>
              {vacantCarparks.map((r) => (
                <option key={r.roomCode} value={r.roomCode}>
                  {r.roomCode} ({r.propertyName})
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("押金 Security RM", "Security Deposit RM")}>
            <input type="number" className="input" value={form.securityDeposit} onChange={(e) => set("securityDeposit", e.target.value)} />
          </Field>
          <Field label={t("水电押 Utilities RM", "Utilities Deposit RM")}>
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

        <Row>
          <Field label={t("Pro-rata 租金 RM (提前入住, 选填)", "Pro-rata Rent RM (early move-in, optional)")}>
            <input
              type="number"
              className="input"
              value={form.prorataAmount}
              onChange={(e) => set("prorataAmount", e.target.value)}
            />
          </Field>
          <Field label={t("Pro-rata 到期日", "Pro-rata Due Date")}>
            <input
              type="date"
              className="input"
              value={form.prorataDueDate}
              onChange={(e) => set("prorataDueDate", e.target.value)}
            />
          </Field>
        </Row>
        <p className="-mt-1 text-xs text-gray-400">
          {t(
            "租客提前入住才需要填：金额自己算好填进去，建立合同后系统会马上开一笔账单给租客。",
            "Only needed if the tenant is moving in early: enter the amount you've calculated — the system opens a bill for it immediately once the contract is created."
          )}
        </p>

        <p className="pt-1 text-xs text-gray-400">
          {t(
            "国籍/职业/公司/车牌/紧急联络人等资料，租客签名前会自己在「我的租约」补填；银行资料（退押金用）在「我的资料」自己填。",
            "Nationality/occupation/company/car plate/emergency contact will be filled in by the tenant themselves under \"My Tenancy\" before signing; bank details (for deposit refunds) are filled in under \"My Profile\"."
          )}
        </p>

        <div className="pt-2 text-sm font-semibold text-brand">
          ⚡ {t("适用水电项目 (勾了才写进合同)", "Applicable Utilities (only checked items go into the contract)")}
        </div>
        <div className="flex flex-col gap-2 pt-1">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={utils.electric}
              onChange={(e) => setUtils({ ...utils, electric: e.target.checked })}
            />
            {t("Electricity Usage 电费 (RM0.50/kWh)", "Electricity Usage (RM0.50/kWh)")}
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={utils.aircond}
              onChange={(e) => setUtils({ ...utils, aircond: e.target.checked })}
            />
            {t("Air-Conditioner Usage 冷气 (RM0.75/kWh)", "Air-Conditioner Usage (RM0.75/kWh)")}
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={utils.dryer}
              onChange={(e) => setUtils({ ...utils, dryer: e.target.checked })}
            />
            {t("Dryer Usage 烘干机 (RM0.50/kWh)", "Dryer Usage (RM0.50/kWh)")}
          </label>
        </div>

        <div className="pt-3 text-right">
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? t("建立中...", "Creating...") : t("建立合同", "Create Contract")}
          </button>
        </div>
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
