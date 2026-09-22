"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { contractStatusLabel } from "@/lib/config";
import { fmtDate } from "@/lib/format";
import { useLanguage } from "@/components/LanguageProvider";
import ContractActions, { type ActionableContract } from "../ContractActions";
import StepTimeline from "@/components/StepTimeline";
import { buildContractSteps } from "@/lib/contractSteps";

interface ContractDetail extends ActionableContract {
  room: { roomCode: string; propertyCode: string | null; propertyName: string };
  carparkRoom: { roomCode: string; propertyName: string; carparkLotNumber: string | null } | null;
  propertyAddress: string | null;
  tenantIc: string | null;
  moveInDate: string | null;
  commencementDate: string | null;
  expiredDate: string | null;
  moveOutNoticeDate: string | null;
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
  icFront: string | null;
  icBack: string | null;
  _paid: number;
  _pendingReview: number;
  _outstanding: number;
  _moveInDone: boolean;
  _isLegacy: boolean;
}

function fmt(v: number | null) {
  return v || v === 0 ? `RM${Number(v).toLocaleString()}` : "-";
}
export default function ContractDetailClient({ contractId, role }: { contractId: string; role: string }) {
  const { locale, t } = useLanguage();
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
      setError(t("出错，请稍后再试", "Something went wrong — please try again later"));
    }
  }, [contractId, t]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  if (error) return <div className="rounded-xl bg-white p-5 text-sm text-red-600 shadow-sm">{error}</div>;
  if (!contract) return <div className="rounded-xl bg-white p-5 text-sm text-gray-500 shadow-sm">{t("载入中...", "Loading...")}</div>;

  const c = contract;
  const utils = [
    c.utilElectric && t("水电", "Electricity"),
    c.utilAircond && t("冷气", "Air-Con"),
    c.utilDryer && t("干衣机", "Dryer"),
  ].filter(Boolean);
  const flow = buildContractSteps(
    {
      status: c.status,
      agentSigned: !!c.agentSignature,
      tenantSigned: !!c.tenantSignature,
      icDone: !!c.icFront && !!c.icBack,
      moveInDone: c._moveInDone,
      outstanding: c._outstanding,
      isLegacy: c._isLegacy,
    },
    t
  );

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="rounded-xl bg-white p-5 shadow-sm">
        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-brand">
            📄 {c.contractCode}{" "}
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-600 align-middle">
              {contractStatusLabel(c.status, locale)}
            </span>
          </h3>
          <Link href="/contracts" className="text-sm text-gray-500 hover:underline">
            ← {t("返回合同清单", "Back to Contracts")}
          </Link>
        </div>

        {c._rentEscalated && (
          <div className="mb-3.5 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">
            ⚠️ {t("租金逾期超10天", "Rent overdue 10+ days")}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <Info label={t("房间", "Room")}>
            <Link href={`/rooms/${c.room.roomCode}`} className="text-brand hover:underline">
              {c.room.roomCode}
            </Link>
          </Info>
          <Info label={t("楼盘地址", "Property Address")}>{c.propertyAddress || c.room.propertyName}</Info>
          <Info label={t("车位", "Carpark")}>
            {c.carparkRoom ? (
              <Link href={`/rooms/${c.carparkRoom.roomCode}`} className="text-brand hover:underline">
                {c.carparkRoom.roomCode}
                {c.carparkRoom.carparkLotNumber ? ` (${c.carparkRoom.carparkLotNumber})` : ""}
              </Link>
            ) : (
              "-"
            )}
          </Info>
          <Info label="Agent">{c.agentName}</Info>
          <Info label={t("Move-in 日期", "Move-in Date")}>{fmtDate(c.moveInDate)}</Info>
          <Info label={t("租约开始日", "Tenancy Start Date")}>{fmtDate(c.commencementDate)}</Info>
          <Info label={t("到期日", "Expiry Date")}>{fmtDate(c.expiredDate)}</Info>
          <Info label={t("租期", "Tenure")}>{c.tenureMonths ? `${c.tenureMonths} ${t("个月", "months")}` : "-"}</Info>
          <Info label={t("佣金", "Commission")}>
            {fmt(c.commAmount)} {c.commAmount ? `(${c.commStatus === "Paid" ? t("已付", "Paid") : t("待付", "Pending")})` : ""}
          </Info>
        </div>
      </div>

      <div className="rounded-xl bg-white p-5 shadow-sm">
        <h3 className="mb-3.5 text-base font-semibold text-brand">📋 {t("合同 & 付款流程", "Contract & Payment Progress")}</h3>
        {c.moveOutNoticeDate && (
          <div className="mb-3.5 rounded-lg bg-violet-50 px-3.5 py-2.5 text-sm text-violet-800">
            <span className="font-semibold">📤 {t("租客不续约", "Tenant Not Renewing")}:</span>{" "}
            {t(`登记搬出日期 ${fmtDate(c.moveOutNoticeDate)}，请跟进安排`, `Registered move-out date ${fmtDate(c.moveOutNoticeDate)} — please follow up on arrangements`)}
          </div>
        )}
        {flow.nextAction && (
          <div
            className={`mb-3.5 rounded-lg px-3.5 py-2.5 text-sm ${
              flow.nextAction.who.toUpperCase() === role ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"
            }`}
          >
            {flow.nextAction.who.toUpperCase() === role ? (
              <>
                <span className="font-semibold">⏭️ {t("下一个步骤", "Next Step")}:</span> {flow.nextAction.text}
              </>
            ) : (
              <>
                <span className="font-semibold">
                  ⏳ {t("下一个步骤", "Next Step")} ({t("等", "waiting on")} {flow.nextAction.who}):
                </span>{" "}
                {flow.nextAction.text}
              </>
            )}
          </div>
        )}
        <StepTimeline steps={flow.steps} />
      </div>

      <div className="rounded-xl bg-white p-5 shadow-sm">
        <h3 className="mb-3.5 text-base font-semibold text-brand">💰 {t("财务", "Finance")}</h3>
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <Info label={t("房租", "Rent")}>{fmt(c.roomRental)}</Info>
          <Info label={t("车位租金", "Carpark Rental")}>{fmt(c.carparkRental)}</Info>
          <Info label={t("押金", "Deposit")}>{fmt(c.securityDeposit)}</Info>
          <Info label={t("水电押金", "Utilities Deposit")}>{fmt(c.utilitiesDeposit)}</Info>
          <Info label={t("门卡押金", "Access Card Deposit")}>{fmt(c.accessCardDeposit)}</Info>
          <Info label="Admin Fee">{fmt(c.adminFee)}</Info>
          <Info label={t("总款", "Total")}>{fmt(c.totalOutstanding)}</Info>
          <Info label={t("已收", "Paid")}>
            {fmt(c._paid)}
            {c._pendingReview > 0 && (
              <span className="ml-1 text-xs font-normal text-amber-600">
                ({t("含待审核", "incl. pending review")} {fmt(c._pendingReview)})
              </span>
            )}
          </Info>
          <Info label={t("还欠", "Owing")}>
            {c._outstanding > 0 ? (
              <span className="font-semibold text-red-600">{fmt(c._outstanding)}</span>
            ) : (
              <span className="text-green-700">✅{t("清", "Settled")}</span>
            )}
          </Info>
        </div>
      </div>

      <div className="rounded-xl bg-white p-5 shadow-sm">
        <h3 className="mb-3.5 text-base font-semibold text-brand">👤 {t("租客资料", "Tenant Information")}</h3>
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <Info label={t("姓名", "Name")}>{c.tenantName}</Info>
          <Info label="IC">{c.tenantIc || "-"}</Info>
          <Info label={t("国籍", "Nationality")}>{c.nationality || "-"}</Info>
          <Info label={t("电话", "Phone")}>{c.contactNumber || "-"}</Info>
          <Info label="Email">{c.email || "-"}</Info>
          <Info label={t("职业", "Occupation")}>{c.occupation || "-"}</Info>
          <Info label={t("公司/大学", "Company/University")}>{c.company || "-"}</Info>
          <Info label={t("车牌", "Car Plate")}>{c.carPlate || "-"}</Info>
          <Info label={t("水电设施", "Utilities")}>{utils.length ? utils.join(", ") : t("无勾选", "None checked")}</Info>
        </div>

        <div className="mt-3.5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <Info label={t("紧急联络人", "Emergency Contact Name")}>{c.emergencyName || "-"}</Info>
          <Info label={t("联络人电话", "Emergency Contact Phone")}>{c.emergencyContact || "-"}</Info>
          <Info label={t("关系", "Relationship")}>{c.emergencyRelationship || "-"}</Info>
        </div>

        {c.remarks && <div className="mt-3.5 rounded-lg bg-gray-50 p-3 text-sm text-gray-600">📝 {c.remarks}</div>}
      </div>

      <div className="rounded-xl bg-white p-5 shadow-sm">
        <h3 className="mb-3.5 text-base font-semibold text-brand">🔧 {t("操作", "Actions")}</h3>
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
