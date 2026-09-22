"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { RULES, contractStatusLabel } from "@/lib/config";
import { fmtDate } from "@/lib/format";
import { useToast } from "@/components/Toast";
import { useLanguage } from "@/components/LanguageProvider";
import SignatureModal from "../contracts/SignatureModal";
import ICUploadModal from "../contracts/ICUploadModal";
import TenantInfoEditModal from "./TenantInfoEditModal";
import WarningLettersModal from "./WarningLettersModal";
import StepTimeline from "@/components/StepTimeline";
import { buildContractSteps } from "@/lib/contractSteps";

interface Card {
  contractCode: string;
  roomCode: string;
  carparkRoomCode: string | null;
  carparkLotNumber: string | null;
  status: string;
  agentSigned: boolean;
  tenantSigned: boolean;
  isLegacy: boolean;
  expiredDate: string | null;
  daysToExpiry: number | null;
  moveOutNoticeDate: string | null;
  renewalRequestedAt: string | null;
  renewalRequestedMonths: number | null;
  warningLetterCount: number;
  hasICFront: boolean;
  hasICBack: boolean;
  moveInDone: boolean;
  outstanding: number;
  nationality: string | null;
  contactNumber: string | null;
  email: string | null;
  occupation: string | null;
  company: string | null;
  carPlate: string | null;
  emergencyName: string | null;
  emergencyContact: string | null;
  emergencyRelationship: string | null;
  pdfLink: string | null;
}

function Pill({ tone, children }: { tone: "done" | "wait" | "lock" | "due"; children: React.ReactNode }) {
  const cls: Record<string, string> = {
    done: "bg-green-50 text-green-700",
    wait: "bg-yellow-50 text-yellow-800",
    lock: "bg-gray-100 text-gray-500",
    due: "bg-red-50 text-red-700",
  };
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${cls[tone]}`}>{children}</span>;
}

export default function MyTenancyClient() {
  const toast = useToast();
  const { locale, t } = useLanguage();
  const [cards, setCards] = useState<Card[] | null>(null);
  const [error, setError] = useState("");
  const [signing, setSigning] = useState<string | null>(null);
  const [icUploading, setIcUploading] = useState<string | null>(null);
  const [editingInfo, setEditingInfo] = useState<Card | null>(null);
  const [viewingLetters, setViewingLetters] = useState<string | null>(null);
  const [movingOutId, setMovingOutId] = useState<string | null>(null);
  const [moveOutDate, setMoveOutDate] = useState("");
  const [movingOutSaving, setMovingOutSaving] = useState(false);
  const [renewingId, setRenewingId] = useState<string | null>(null);
  const [renewMonths, setRenewMonths] = useState("12");
  const [renewingSaving, setRenewingSaving] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/contracts/my-cards");
      const data = await res.json();
      if (!data.success) return setError(data.message);
      setCards(data.cards);
    } catch {
      setError(t("出错，请稍后再试", "Something went wrong — please try again later"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // setState happens after the fetch's await, not synchronously in the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function submitMoveOutNotice(contractCode: string) {
    if (!moveOutDate) {
      toast.warning(t("请选日期", "Please pick a date"));
      return;
    }
    setMovingOutSaving(true);
    try {
      const res = await fetch(`/api/contracts/${contractCode}/move-out-notice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: moveOutDate }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setMovingOutId(null);
        load();
      } else {
        toast.danger(data.message);
      }
    } catch {
      toast.danger(t("系统出错，请稍后再试", "System error — please try again later"));
    } finally {
      setMovingOutSaving(false);
    }
  }

  async function submitRenewalRequest(contractCode: string) {
    const months = Number(renewMonths);
    if (!months || months < 1) {
      toast.warning(t("请填要续约的月数", "Please enter how many months to renew"));
      return;
    }
    setRenewingSaving(true);
    try {
      const res = await fetch(`/api/contracts/${contractCode}/renewal-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ months }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setRenewingId(null);
        load();
      } else {
        toast.danger(data.message);
      }
    } catch {
      toast.danger(t("系统出错，请稍后再试", "System error — please try again later"));
    } finally {
      setRenewingSaving(false);
    }
  }

  if (error) return <div className="rounded-xl bg-white p-5 text-sm text-red-600 shadow-sm">{error}</div>;
  if (!cards) return <div className="rounded-xl bg-white p-5 text-sm text-gray-500 shadow-sm">{t("载入中...", "Loading...")}</div>;
  if (cards.length === 0) {
    return (
      <div className="rounded-xl bg-white p-5 text-center text-gray-400 shadow-sm">
        {t("你还没有租约", "You don't have a tenancy yet")}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {cards.map((c) => {
        const icDone = c.hasICFront && c.hasICBack;
        const canSign = c.agentSigned && icDone && !c.tenantSigned;
        const flow = buildContractSteps(
          {
            status: c.status,
            agentSigned: c.agentSigned,
            tenantSigned: c.tenantSigned,
            icDone,
            moveInDone: c.moveInDone,
            outstanding: c.outstanding,
            isLegacy: c.isLegacy,
          },
          t
        );

        return (
          <div key={c.contractCode} className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 bg-gradient-to-br from-brand to-fuchsia-600 px-5 py-4 text-white">
              <div>
                <div className="text-lg font-bold">{c.contractCode}</div>
                <div className="text-sm opacity-90">🏠 {c.roomCode}</div>
                {c.carparkRoomCode && (
                  <div className="text-sm opacity-90">
                    🚗 {c.carparkRoomCode}
                    {c.carparkLotNumber ? ` (Lot ${c.carparkLotNumber})` : ""}
                  </div>
                )}
              </div>
              <div className="rounded-full bg-white/20 px-3.5 py-1 text-xs font-semibold">
                {contractStatusLabel(c.status, locale)}
              </div>
            </div>

            <div className="border-b border-gray-50 px-5 py-4">
              <b className="mb-2.5 block text-sm text-gray-600">{t("📋 合同 & 付款流程", "📋 Contract & Payment Progress")}</b>
              {flow.nextAction && (
                <div
                  className={`mb-2.5 rounded-lg px-3.5 py-2.5 text-sm ${
                    flow.nextAction.who === "Tenant" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"
                  }`}
                >
                  {flow.nextAction.who === "Tenant" ? (
                    <>
                      <span className="font-semibold">{t("⏭️ 下一个步骤:", "⏭️ Next step:")}</span> {flow.nextAction.text}
                    </>
                  ) : (
                    <>
                      <span className="font-semibold">
                        {t(`⏳ 下一个步骤 (等 ${flow.nextAction.who}):`, `⏳ Next step (waiting on ${flow.nextAction.who}):`)}
                      </span>{" "}
                      {flow.nextAction.text}
                    </>
                  )}
                </div>
              )}
              <StepTimeline steps={flow.steps} />
            </div>

            <div className="px-5 py-1">
              <Row
                icon="📄"
                name={t("合同 Agreement", "Agreement")}
                desc={t("查看完整合同与条款", "View the full agreement and terms")}
                status={<Pill tone={c.status === "ACTIVE" ? "done" : "wait"}>{contractStatusLabel(c.status, locale)}</Pill>}
                action={
                  <Link href={`/agreement/${c.contractCode}`} className="btn-soft px-3.5 py-1.5 text-xs">
                    {t("查看合同", "View Agreement")}
                  </Link>
                }
              />

              {c.expiredDate && c.status === "ACTIVE" && (
                <Row
                  icon="📅"
                  name={t("租约到期 Lease Expiry", "Lease Expiry")}
                  desc={
                    c.renewalRequestedAt
                      ? t(
                          `${fmtDate(c.expiredDate)} · 已申请续约 ${c.renewalRequestedMonths} 个月 (${fmtDate(c.renewalRequestedAt)})，等 Admin 处理`,
                          `${fmtDate(c.expiredDate)} · Requested renewal for ${c.renewalRequestedMonths} months (${fmtDate(c.renewalRequestedAt)}), pending Admin`
                        )
                      : c.moveOutNoticeDate
                        ? t(
                            `${fmtDate(c.expiredDate)} · 已登记搬出日期: ${fmtDate(c.moveOutNoticeDate)}`,
                            `${fmtDate(c.expiredDate)} · Registered move-out date: ${fmtDate(c.moveOutNoticeDate)}`
                          )
                        : c.daysToExpiry !== null && c.daysToExpiry <= RULES.NOTICE_MONTHS * 30
                          ? t(
                              `${fmtDate(c.expiredDate)} · 要续约或搬出，请选一个`,
                              `${fmtDate(c.expiredDate)} · Please choose to renew or move out`
                            )
                          : (fmtDate(c.expiredDate) as string)
                  }
                  status={
                    c.renewalRequestedAt ? (
                      <Pill tone="wait">{t("🔄 已申请续约", "🔄 Renewal Requested")}</Pill>
                    ) : c.moveOutNoticeDate ? (
                      <Pill tone="done">{t("📤 不续约", "📤 Not Renewing")}</Pill>
                    ) : c.daysToExpiry !== null && c.daysToExpiry < 0 ? (
                      <Pill tone="due">{t(`⚠️ 已过期 ${Math.abs(c.daysToExpiry)} 天`, `⚠️ Expired ${Math.abs(c.daysToExpiry)} days ago`)}</Pill>
                    ) : c.daysToExpiry !== null && c.daysToExpiry <= RULES.NOTICE_MONTHS * 30 ? (
                      <Pill tone="wait">{t(`⏰ 还剩 ${c.daysToExpiry} 天`, `⏰ ${c.daysToExpiry} days left`)}</Pill>
                    ) : (
                      <Pill tone="done">{t(`还剩 ${c.daysToExpiry} 天`, `${c.daysToExpiry} days left`)}</Pill>
                    )
                  }
                  action={
                    !c.renewalRequestedAt &&
                    !c.moveOutNoticeDate &&
                    c.daysToExpiry !== null &&
                    c.daysToExpiry <= RULES.NOTICE_MONTHS * 30 &&
                    movingOutId !== c.contractCode &&
                    renewingId !== c.contractCode && (
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          onClick={() => {
                            setRenewingId(c.contractCode);
                            setRenewMonths("12");
                          }}
                          className="btn-primary px-3.5 py-1.5 text-xs"
                        >
                          {t("🔄 我要续约", "🔄 I Want to Renew")}
                        </button>
                        <button
                          onClick={() => {
                            setMovingOutId(c.contractCode);
                            setMoveOutDate("");
                          }}
                          className="btn-soft px-3.5 py-1.5 text-xs"
                        >
                          {t("不续约, 我要搬出", "Not Renewing, I'm Moving Out")}
                        </button>
                      </div>
                    )
                  }
                />
              )}

              {renewingId === c.contractCode && (
                <div className="flex flex-wrap items-end gap-2.5 border-b border-gray-50 px-5 py-3.5">
                  <div>
                    <label className="mb-1.5 block text-sm text-gray-600">{t("要续约几个月？", "How many months?")}</label>
                    <select value={renewMonths} onChange={(e) => setRenewMonths(e.target.value)} className="input">
                      <option value="6">{t("6 个月", "6 months")}</option>
                      <option value="12">{t("12 个月", "12 months")}</option>
                      <option value="24">{t("24 个月", "24 months")}</option>
                    </select>
                  </div>
                  <button
                    onClick={() => submitRenewalRequest(c.contractCode)}
                    disabled={renewingSaving}
                    className="btn-primary px-3.5 py-1.5 text-xs"
                  >
                    {renewingSaving ? t("提交中...", "Submitting...") : t("确认申请续约", "Confirm Renewal Request")}
                  </button>
                  <button onClick={() => setRenewingId(null)} className="btn-soft px-3.5 py-1.5 text-xs">
                    {t("取消", "Cancel")}
                  </button>
                </div>
              )}

              {movingOutId === c.contractCode && (
                <div className="flex flex-wrap items-end gap-2.5 border-b border-gray-50 px-5 py-3.5">
                  <div>
                    <label className="mb-1.5 block text-sm text-gray-600">{t("预计搬出日期", "Expected Move-out Date")}</label>
                    <input
                      type="date"
                      value={moveOutDate}
                      onChange={(e) => setMoveOutDate(e.target.value)}
                      className="input"
                    />
                  </div>
                  <button
                    onClick={() => submitMoveOutNotice(c.contractCode)}
                    disabled={movingOutSaving}
                    className="btn-primary px-3.5 py-1.5 text-xs"
                  >
                    {movingOutSaving ? t("提交中...", "Submitting...") : t("确认登记", "Confirm")}
                  </button>
                  <button onClick={() => setMovingOutId(null)} className="btn-soft px-3.5 py-1.5 text-xs">
                    {t("取消", "Cancel")}
                  </button>
                </div>
              )}

              {c.pdfLink && (
                <Row
                  icon="📎"
                  name={t("旧合同 PDF", "Legacy Contract PDF")}
                  desc={t("Admin 上传的签名版扫描件", "Signed scan uploaded by Admin")}
                  status={<Pill tone="done">{t("✅ 已上传", "✅ Uploaded")}</Pill>}
                  action={
                    <a href={c.pdfLink} target="_blank" rel="noopener noreferrer" className="btn-soft px-3.5 py-1.5 text-xs">
                      {t("查看 / 下载", "View / Download")}
                    </a>
                  }
                />
              )}

              <Row
                icon="✍️"
                name={t("合同签名 Signature", "Signature")}
                status={
                  c.isLegacy ? (
                    <Pill tone="done">{t("✅ 旧合同 (纸本已签)", "✅ Legacy Contract (Signed on Paper)")}</Pill>
                  ) : c.tenantSigned ? (
                    <Pill tone="done">{t("✅ 已签", "✅ Signed")}</Pill>
                  ) : !c.agentSigned ? (
                    <Pill tone="lock">{t("🔒 等 Agent 先签", "🔒 Waiting on Agent to sign first")}</Pill>
                  ) : !icDone ? (
                    <Pill tone="wait">{t("⚠️ 先上传 IC", "⚠️ Upload IC first")}</Pill>
                  ) : (
                    <Pill tone="wait">{t("待签名", "Awaiting Signature")}</Pill>
                  )
                }
                action={
                  canSign && (
                    <button onClick={() => setSigning(c.contractCode)} className="btn-primary px-3.5 py-1.5 text-xs">
                      {t("签名", "Sign")}
                    </button>
                  )
                }
              />

              <Row
                icon="🪪"
                name={t("IC / 护照", "IC / Passport")}
                desc={t("正反面副本", "Front and back copy")}
                status={
                  icDone ? (
                    <Pill tone="done">{t("✅ 已上传", "✅ Uploaded")}</Pill>
                  ) : c.hasICFront || c.hasICBack ? (
                    <Pill tone="wait">{t("⚠️ 差一面", "⚠️ Missing one side")}</Pill>
                  ) : (
                    <Pill tone="wait">{t("⚠️ 未上传", "⚠️ Not uploaded")}</Pill>
                  )
                }
                action={
                  <button onClick={() => setIcUploading(c.contractCode)} className="btn-soft px-3.5 py-1.5 text-xs">
                    {icDone ? t("查看", "View") : t("上传", "Upload")}
                  </button>
                }
              />

              <Row
                icon="📇"
                name={t("个人资料 Personal Info", "Personal Info")}
                desc={t("国籍/职业/公司/车牌/紧急联络人", "Nationality/Occupation/Company/Car Plate/Emergency Contact")}
                status={null}
                action={
                  <button onClick={() => setEditingInfo(c)} className="btn-soft px-3.5 py-1.5 text-xs">
                    {t("✏️ 编辑", "✏️ Edit")}
                  </button>
                }
              />

              {c.warningLetterCount > 0 && (
                <Row
                  icon="⚠️"
                  name={t("警告信 Warning Letter", "Warning Letter")}
                  status={<Pill tone="due">{t(`${c.warningLetterCount} 封`, `${c.warningLetterCount}`)}</Pill>}
                  action={
                    <button onClick={() => setViewingLetters(c.contractCode)} className="btn-soft px-3.5 py-1.5 text-xs">
                      {t("查看", "View")}
                    </button>
                  }
                />
              )}
            </div>
          </div>
        );
      })}

      {signing && (
        <SignatureModal contractCode={signing} who="tenant" onClose={() => setSigning(null)} onSigned={load} />
      )}
      {icUploading && (
        <ICUploadModal contractCode={icUploading} onClose={() => setIcUploading(null)} onUploaded={load} />
      )}
      {editingInfo && (
        <TenantInfoEditModal
          contractCode={editingInfo.contractCode}
          info={editingInfo}
          onClose={() => setEditingInfo(null)}
          onSaved={load}
        />
      )}
      {viewingLetters && (
        <WarningLettersModal contractCode={viewingLetters} onClose={() => setViewingLetters(null)} />
      )}
    </div>
  );
}

function Row({
  icon,
  name,
  desc,
  status,
  action,
}: {
  icon: string;
  name: string;
  desc?: string;
  status: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-50 py-3.5 last:border-none">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-light text-lg">
          {icon}
        </div>
        <div>
          <div className="text-sm font-semibold text-gray-800">{name}</div>
          {desc && <div className="text-xs text-gray-400">{desc}</div>}
        </div>
      </div>
      <div className="flex items-center gap-2.5">
        {status}
        {action}
      </div>
    </div>
  );
}
