"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CONTRACT_STATUS_LABELS } from "@/lib/config";
import { fmtDate } from "@/lib/format";
import ContractActions, { type ActionableContract } from "../ContractActions";

interface ContractDetail extends ActionableContract {
  room: { roomCode: string; propertyCode: string | null; propertyName: string };
  propertyAddress: string | null;
  tenantIc: string | null;
  moveInDate: string | null;
  commencementDate: string | null;
  expiredDate: string | null;
  tenureMonths: number | null;
  roomRental: number;
  carparkRental: number;
  securityDeposit: number;
  utilitiesDeposit: number;
  accessCardDeposit: number;
  adminFee: number;
  nationality: string | null;
  contactNumber: string | null;
  email: string | null;
  occupation: string | null;
  company: string | null;
  carPlate: string | null;
  emergencyName: string | null;
  emergencyContact: string | null;
  emergencyRelationship: string | null;
  utilDryer: boolean;
  utilAircond: boolean;
  utilElectric: boolean;
  commAmount: number | null;
  commStatus: string | null;
  remarks: string | null;
  pdfLink: string | null;
  _paid: number;
  _outstanding: number;
}

function fmt(v: number | null) {
  return v || v === 0 ? `RM${Number(v).toLocaleString()}` : "-";
}
export default function ContractDetailClient({ contractId, role }: { contractId: string; role: string }) {
  const [contract, setContract] = useState<ContractDetail | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/contracts/${contractId}`);
      const data = await res.json();
      if (!data.success) {
        setError(data.message);
        return;
      }
      setContract(data.contract);
    } catch {
      setError("出错，请稍后再试");
    }
  }, [contractId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  if (error) return <div className="rounded-xl bg-white p-5 text-sm text-red-600 shadow-sm">{error}</div>;
  if (!contract) return <div className="rounded-xl bg-white p-5 text-sm text-gray-500 shadow-sm">载入中...</div>;

  const c = contract;
  const utils = [c.utilElectric && "水电", c.utilAircond && "冷气", c.utilDryer && "干衣机"].filter(Boolean);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="rounded-xl bg-white p-5 shadow-sm">
        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-brand">
            📄 {c.contractCode}{" "}
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-600 align-middle">
              {CONTRACT_STATUS_LABELS[c.status] ?? c.status}
            </span>
          </h3>
          <Link href="/contracts" className="text-sm text-gray-500 hover:underline">
            ← 返回合同清单
          </Link>
        </div>

        {c._rentEscalated && (
          <div className="mb-3.5 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">
            ⚠️ 租金逾期超10天
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <Info label="房间">
            <Link href={`/rooms/${c.room.roomCode}`} className="text-brand hover:underline">
              {c.room.roomCode}
            </Link>
          </Info>
          <Info label="楼盘地址">{c.propertyAddress || c.room.propertyName}</Info>
          <Info label="Agent">{c.agentName}</Info>
          <Info label="Move-in 日期">{fmtDate(c.moveInDate)}</Info>
          <Info label="租约开始日">{fmtDate(c.commencementDate)}</Info>
          <Info label="到期日">{fmtDate(c.expiredDate)}</Info>
          <Info label="租期">{c.tenureMonths ? `${c.tenureMonths} 个月` : "-"}</Info>
          <Info label="佣金">
            {fmt(c.commAmount)} {c.commAmount ? `(${c.commStatus === "Paid" ? "已付" : "待付"})` : ""}
          </Info>
        </div>
      </div>

      <div className="rounded-xl bg-white p-5 shadow-sm">
        <h3 className="mb-3.5 text-base font-semibold text-brand">💰 财务</h3>
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <Info label="房租">{fmt(c.roomRental)}</Info>
          <Info label="车位租金">{fmt(c.carparkRental)}</Info>
          <Info label="押金">{fmt(c.securityDeposit)}</Info>
          <Info label="水电押金">{fmt(c.utilitiesDeposit)}</Info>
          <Info label="门卡押金">{fmt(c.accessCardDeposit)}</Info>
          <Info label="Admin Fee">{fmt(c.adminFee)}</Info>
          <Info label="总款">{fmt(c.totalOutstanding)}</Info>
          <Info label="已收">{fmt(c._paid)}</Info>
          <Info label="还欠">
            {c._outstanding > 0 ? (
              <span className="font-semibold text-red-600">{fmt(c._outstanding)}</span>
            ) : (
              <span className="text-green-700">✅清</span>
            )}
          </Info>
        </div>
      </div>

      <div className="rounded-xl bg-white p-5 shadow-sm">
        <h3 className="mb-3.5 text-base font-semibold text-brand">👤 租客资料</h3>
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <Info label="姓名">{c.tenantName}</Info>
          <Info label="IC">{c.tenantIc || "-"}</Info>
          <Info label="国籍">{c.nationality || "-"}</Info>
          <Info label="电话">{c.contactNumber || "-"}</Info>
          <Info label="Email">{c.email || "-"}</Info>
          <Info label="职业">{c.occupation || "-"}</Info>
          <Info label="公司/大学">{c.company || "-"}</Info>
          <Info label="车牌">{c.carPlate || "-"}</Info>
          <Info label="水电设施">{utils.length ? utils.join(", ") : "无勾选"}</Info>
        </div>

        <div className="mt-3.5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <Info label="紧急联络人">{c.emergencyName || "-"}</Info>
          <Info label="联络人电话">{c.emergencyContact || "-"}</Info>
          <Info label="关系">{c.emergencyRelationship || "-"}</Info>
        </div>

        {c.remarks && <div className="mt-3.5 rounded-lg bg-gray-50 p-3 text-sm text-gray-600">📝 {c.remarks}</div>}
      </div>

      <div className="rounded-xl bg-white p-5 shadow-sm">
        <h3 className="mb-3.5 text-base font-semibold text-brand">🔧 操作</h3>
        <ContractActions contract={c} role={role} onChanged={load} variant="full" />
      </div>
    </div>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-gray-400">{label}</div>
      <div>{children}</div>
    </div>
  );
}
