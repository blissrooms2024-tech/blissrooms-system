"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/components/LanguageProvider";
import { ROLE_LABELS, userStatusLabel, contractStatusLabel, paymentTypeLabelLocale, maintenanceStatusLabel } from "@/lib/config";
import { fmtDate, fmtMoney as fmt } from "@/lib/format";

interface UserInfo {
  userCode: string;
  name: string;
  email: string;
  role: string;
  phone: string | null;
  ic: string | null;
  status: string;
  verified: boolean;
  bankName: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  commRate: number | null;
  createdAt: string;
}
interface TenantContractRow {
  contractCode: string;
  roomCode: string;
  status: string;
  expiredDate: string | null;
  totalOutstanding: number;
  paid: number;
  outstanding: number;
}
interface PaymentRow {
  paymentCode: string;
  contractCode: string;
  roomCode: string;
  type: string;
  customLabel: string | null;
  amountDue: number;
  amountPaid: number;
  status: string;
  periodMonth: string | null;
  dueDate: string | null;
  paidDate: string | null;
}
interface MaintenanceRow {
  requestCode: string;
  roomCode: string;
  title: string;
  status: string;
  createdAt: string;
}
interface AgentContractRow {
  contractCode: string;
  roomCode: string;
  tenantName: string;
  status: string;
  commAmount: number | null;
  commStatus: string | null;
}

export default function UserDetailClient({ userId }: { userId: string }) {
  const { locale, t } = useLanguage();
  const [data, setData] = useState<{
    user: UserInfo;
    contracts: TenantContractRow[];
    payments: PaymentRow[];
    maintenanceRequests: MaintenanceRow[];
    agentContracts: AgentContractRow[];
    agentStats: { tenantCount: number; roomCount: number; commissionPaid: number; commissionPending: number } | null;
  } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/users/${userId}/detail`)
      .then((r) => r.json())
      .then((res) => {
        if (!res.success) {
          setError(res.message);
          return;
        }
        setData(res);
      })
      .catch(() => setError(t("出错，请稍后再试", "Error — please try again later")));
  }, [userId, t]);

  if (error) return <div className="rounded-xl bg-white p-5 text-sm text-red-600 shadow-sm">{error}</div>;
  if (!data) return <div className="rounded-xl bg-white p-5 text-sm text-gray-500 shadow-sm">{t("载入中...", "Loading...")}</div>;

  const { user, contracts, payments, maintenanceRequests, agentContracts, agentStats } = data;

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white p-5 shadow-sm">
        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-brand">
            👤 {user.name} <span className="text-sm font-normal text-gray-400">({user.userCode})</span>
          </h3>
          <Link href="/users" className="text-sm text-gray-500 hover:underline">
            ← {t("返回用户清单", "Back to Users")}
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
          <Info label={t("角色", "Role")}>{ROLE_LABELS[user.role] ?? user.role}</Info>
          <Info label={t("状态", "Status")}>{userStatusLabel(user.status, locale)}</Info>
          <Info label={t("Email", "Email")}>{user.email}</Info>
          <Info label={t("电话", "Phone")}>{user.phone || "-"}</Info>
          <Info label="IC">{user.ic || "-"}</Info>
          <Info label={t("验证", "Verified")}>{user.verified ? t("已验证", "Verified") : t("未验证", "Not Verified")}</Info>
          {user.role === "AGENT" && <Info label={t("佣金率", "Comm Rate")}>{user.commRate !== null ? `${(user.commRate * 100).toFixed(0)}%` : "-"}</Info>}
          <Info label={t("注册日期", "Registered")}>{fmtDate(user.createdAt)}</Info>
        </div>
      </div>

      {agentStats && (user.role === "AGENT" || agentContracts.length > 0) && (
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <h3 className="mb-3.5 text-base font-semibold text-brand">💼 {t("Agent 业绩", "Agent Performance")}</h3>
          <div className="mb-3.5 flex flex-wrap gap-2.5">
            <Box label={t("租客数", "Tenants")} value={String(agentStats.tenantCount)} />
            <Box label={t("房间数", "Rooms")} value={String(agentStats.roomCount)} />
            <Box label={t("佣金已付", "Comm Paid")} value={fmt(agentStats.commissionPaid)} color="text-green-700" />
            <Box label={t("佣金待付", "Comm Pending")} value={fmt(agentStats.commissionPending)} color="text-amber-600" />
          </div>
          {agentContracts.length === 0 ? (
            <div className="py-6 text-center text-sm text-gray-400">{t("还没有负责任何合同", "Not handling any contracts yet")}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-gray-600">
                    <Th>{t("合同号", "Contract #")}</Th>
                    <Th>{t("房间", "Room")}</Th>
                    <Th>{t("租客", "Tenant")}</Th>
                    <Th>{t("状态", "Status")}</Th>
                    <Th>{t("佣金", "Commission")}</Th>
                  </tr>
                </thead>
                <tbody>
                  {agentContracts.map((c) => (
                    <tr key={c.contractCode} className="border-b border-gray-100">
                      <Td>
                        <Link href={`/contracts/${c.contractCode}`} className="font-semibold text-brand hover:underline">
                          {c.contractCode}
                        </Link>
                      </Td>
                      <Td>{c.roomCode}</Td>
                      <Td>{c.tenantName}</Td>
                      <Td>{contractStatusLabel(c.status, locale)}</Td>
                      <Td>
                        {c.commAmount !== null ? (
                          <>
                            {fmt(c.commAmount)}{" "}
                            <span className={c.commStatus === "Paid" ? "text-green-700" : "text-amber-600"}>
                              ({c.commStatus === "Paid" ? t("已付", "Paid") : t("待付", "Pending")})
                            </span>
                          </>
                        ) : (
                          "-"
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {(contracts.length > 0 || user.role === "TENANT") && (
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <h3 className="mb-3.5 text-base font-semibold text-brand">📄 {t("我的合同", "Contracts")}</h3>
          {contracts.length === 0 ? (
            <div className="py-6 text-center text-sm text-gray-400">{t("还没有合同", "No contracts yet")}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-gray-600">
                    <Th>{t("合同号", "Contract #")}</Th>
                    <Th>{t("房间", "Room")}</Th>
                    <Th>{t("状态", "Status")}</Th>
                    <Th>{t("到期日", "Expiry Date")}</Th>
                    <Th>{t("已收", "Paid")}</Th>
                    <Th>{t("还欠", "Owing")}</Th>
                  </tr>
                </thead>
                <tbody>
                  {contracts.map((c) => (
                    <tr key={c.contractCode} className="border-b border-gray-100">
                      <Td>
                        <Link href={`/contracts/${c.contractCode}`} className="font-semibold text-brand hover:underline">
                          {c.contractCode}
                        </Link>
                      </Td>
                      <Td>{c.roomCode}</Td>
                      <Td>{contractStatusLabel(c.status, locale)}</Td>
                      <Td>{fmtDate(c.expiredDate)}</Td>
                      <Td>{fmt(c.paid)}</Td>
                      <Td>
                        {c.outstanding > 0 ? (
                          <span className="font-semibold text-red-600">{fmt(c.outstanding)}</span>
                        ) : (
                          <span className="text-green-700">✅{t("清", "Settled")}</span>
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {(payments.length > 0 || user.role === "TENANT") && (
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <h3 className="mb-3.5 text-base font-semibold text-brand">🧾 {t("账单记录 (费用 / 押金 / 房租)", "Billing History (Fees / Deposits / Rent)")}</h3>
          {payments.length === 0 ? (
            <div className="py-6 text-center text-sm text-gray-400">{t("还没有账单记录", "No billing history yet")}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-gray-600">
                    <Th>{t("合同", "Contract")}</Th>
                    <Th>{t("项目", "Item")}</Th>
                    <Th>{t("应收", "Due")}</Th>
                    <Th>{t("已收", "Paid")}</Th>
                    <Th>{t("状态", "Status")}</Th>
                    <Th>{t("日期", "Date")}</Th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.paymentCode} className="border-b border-gray-100">
                      <Td>
                        <Link href={`/contracts/${p.contractCode}`} className="text-brand hover:underline">
                          {p.contractCode}
                        </Link>
                        <div className="text-xs text-gray-500">{p.roomCode}</div>
                      </Td>
                      <Td>
                        {paymentTypeLabelLocale(p.type, p.customLabel, locale)}
                        {p.periodMonth && <span className="text-gray-400"> ({p.periodMonth})</span>}
                      </Td>
                      <Td>{fmt(p.amountDue)}</Td>
                      <Td>{fmt(p.amountPaid)}</Td>
                      <Td>
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">
                          {p.status}
                        </span>
                      </Td>
                      <Td>{fmtDate(p.paidDate ?? p.dueDate)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {(maintenanceRequests.length > 0 || user.role === "TENANT") && (
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <h3 className="mb-3.5 text-base font-semibold text-brand">🔧 {t("报修记录", "Maintenance Reports")}</h3>
          {maintenanceRequests.length === 0 ? (
            <div className="py-6 text-center text-sm text-gray-400">{t("还没有报修记录", "No maintenance reports yet")}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-gray-600">
                    <Th>{t("编号", "Request #")}</Th>
                    <Th>{t("房间", "Room")}</Th>
                    <Th>{t("标题", "Title")}</Th>
                    <Th>{t("状态", "Status")}</Th>
                    <Th>{t("提交日期", "Submitted")}</Th>
                  </tr>
                </thead>
                <tbody>
                  {maintenanceRequests.map((m) => (
                    <tr key={m.requestCode} className="border-b border-gray-100">
                      <Td>{m.requestCode}</Td>
                      <Td>{m.roomCode}</Td>
                      <Td>{m.title}</Td>
                      <Td>{maintenanceStatusLabel(m.status, locale)}</Td>
                      <Td>{fmtDate(m.createdAt)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-gray-400">{label}</div>
      <div className="font-medium text-gray-800">{children}</div>
    </div>
  );
}
function Box({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="min-w-[110px] flex-1 rounded-lg bg-gray-50 p-3 text-center">
      <div className={`text-lg font-bold ${color ?? "text-brand"}`}>{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}
function Th({ children }: { children: React.ReactNode }) {
  return <th className="whitespace-nowrap px-2.5 py-1.5 font-semibold">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="whitespace-nowrap px-2.5 py-1.5">{children}</td>;
}
