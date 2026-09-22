"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { COMPANY, CONTRACT_IMAGES } from "@/lib/config";
import { fmtMoney, fmtDate } from "@/lib/format";
import { useToast } from "@/components/Toast";
import { REPORT_DOC_STYLE } from "@/lib/reportDocStyle";
import { useT } from "@/components/LanguageProvider";

type Period = "month" | "year" | "all";

interface MasterLeaseProperty {
  propertyCode: string;
  name: string;
  landlord: string | null;
  ownerRentalAmount: number;
  ownerDeposit: number | null;
}
interface ManagedProperty {
  propertyCode: string;
  name: string;
  landlord: string | null;
  feeRate: number;
  collected: number;
  payout: number;
}
interface Transaction {
  paidDate: string | null;
  roomCode: string | null;
  carparkCode: string | null;
  contractCode: string;
  tenantName: string;
  type: string;
  typeLabel: string;
  periodMonth: string | null;
  amount: number;
  method: string | null;
}
interface ExpenseTransaction {
  expenseDate: string;
  propertyCode: string;
  propertyName: string;
  category: string;
  label: string;
  amount: number;
  notes: string | null;
}
interface Overview {
  period: Period;
  month: string;
  year: number;
  cashFlow: {
    income: { rental: number; deposits: number; other: number; total: number };
    outflow: { commissionPaid: number; maintenancePaid: number; expensePaid: number; total: number };
    netCashFlow: number;
    transactions: Transaction[];
    expenseTransactions: ExpenseTransaction[];
  };
  obligations: {
    monthsInRange: number;
    ownerRentalMonthlyTotal: number;
    ownerRentalObligation: number;
    landlordPayoutPeriod: number;
    total: number;
    masterLeaseProperties: MasterLeaseProperty[];
    managedProperties: ManagedProperty[];
  };
  deposits: {
    tenant: {
      byType: Record<string, { held: number; forfeited: number }>;
      totalHeld: number;
      totalForfeited: number;
      heldContractCount: number;
      forfeitedContractCount: number;
      byProperty: { propertyCode: string; name: string; amount: number }[];
    };
    owner: { total: number; properties: MasterLeaseProperty[] };
    netExposure: number;
  };
}

const DEPOSIT_TYPE_LABELS: Record<string, string> = {
  DEPOSIT: "押金 Security",
  UTILITIES: "水电押 Utilities",
  ACCESS_CARD: "门卡押 Access Card",
};

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export default function FinanceOverviewClient() {
  const toast = useToast();
  // Renamed to `tt` (not `t`) because the income-transaction .map() below uses `t` as its
  // loop variable — same shadowing fix as SignatureModal.tsx.
  const tt = useT();
  const periodLabels: Record<Period, string> = {
    month: tt("本月", "This Month"),
    year: tt("本年", "This Year"),
    all: tt("累计", "All Time"),
  };
  const [period, setPeriod] = useState<Period>("month");
  const [month, setMonth] = useState(currentMonth());
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const printAreaRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const qs = new URLSearchParams({ period });
      if (period === "month") qs.set("month", month);
      if (period === "year") qs.set("year", String(year));
      const res = await fetch(`/api/finance/overview?${qs}`);
      const d = await res.json();
      if (!d.success) {
        setError(d.message);
        return;
      }
      setData(d);
    } catch {
      setError(tt("出错，请稍后再试", "An error occurred, please try again later"));
    }
  }, [period, month, year, tt]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  function printReport() {
    if (!printAreaRef.current) return;
    const html = printAreaRef.current.innerHTML;
    const w = window.open("", "_blank");
    if (!w) {
      toast.warning(tt("浏览器拦截了弹出式窗口，请允许弹窗后再试一次", "The browser blocked the pop-up window. Please allow pop-ups and try again."));
      return;
    }
    w.document.write(
      `<html><head><title>${tt("财务总览", "Finance Overview")} - Bliss Rooms</title><meta charset="utf-8">` +
        `<style>body{margin:0;padding:34px;max-width:900px;margin:auto;}@media print{@page{margin:14mm;}}</style>` +
        `</head><body>${html}</body></html>`
    );
    w.document.close();
    setTimeout(() => w.print(), 400);
  }

  const years = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i);

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white p-5 shadow-sm">
        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2.5 no-print">
          <h3 className="text-base font-semibold text-brand">{tt("💰 财务总览 — 现金流 & 押金", "💰 Finance Overview — Cash Flow & Deposits")}</h3>
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex gap-1.5">
              {(["month", "year", "all"] as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    period === p ? "bg-brand text-white" : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {periodLabels[p]}
                </button>
              ))}
            </div>
            {period === "month" && (
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
              />
            )}
            {period === "year" && (
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            )}
            {data && (
              <button onClick={printReport} className="rounded-lg bg-green-700 px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-green-800">
                {tt("🖨️ 打印 / 存 PDF", "🖨️ Print / Save PDF")}
              </button>
            )}
          </div>
        </div>

        {error && <div className="text-sm text-red-600">{error}</div>}
        {!data && !error && <div className="text-sm text-gray-500">{tt("载入中...", "Loading...")}</div>}

        {data && (
          <div ref={printAreaRef}>
            <div className="reportDoc">
              <style>{REPORT_DOC_STYLE}</style>

              <div className="hd">
                <div className="brand">
                  {CONTRACT_IMAGES.logo && <img src={CONTRACT_IMAGES.logo} alt="logo" />}
                  <div>
                    <div className="nm">{COMPANY.NAME}</div>
                    <div className="sub">{tt("现金流 & 押金总览", "Cash Flow & Deposits Overview")}</div>
                  </div>
                </div>
                <div className="titleBlock">
                  <div className="title">FINANCE OVERVIEW</div>
                  <div className="titleMeta">
                    {data.period === "month" && `${tt("现金流报告月份", "Cash flow report month")}: ${data.month}`}
                    {data.period === "year" && `${tt("现金流报告年份", "Cash flow report year")}: ${data.year}`}
                    {data.period === "all" && tt("现金流: 累计 (至今)", "Cash flow: cumulative (to date)")}
                    <br />
                    {tt("押金: 当前实况 (截至今日)", "Deposits: current snapshot (as of today)")}
                  </div>
                </div>
              </div>

              <h4>
                {tt("💵 现金流 (Cash Flow) — ", "💵 Cash Flow — ")}
                {periodLabels[data.period]}
                {tt("实际入账/出账", " Actual Inflow/Outflow")}
              </h4>
              <div className="statRow">
                <div className="stat">
                  <div className="n">{fmtMoney(data.cashFlow.income.total)}</div>
                  <div className="l">{tt("总收入 (实收)", "Total Income (Received)")}</div>
                </div>
                <div className="stat alt">
                  <div className="n">{fmtMoney(data.cashFlow.outflow.total)}</div>
                  <div className="l">{tt("实际支出 (佣金+维修+楼盘支出)", "Total Outflow (Commission + Maintenance + Property Expenses)")}</div>
                </div>
                <div className="stat" style={{ background: data.cashFlow.netCashFlow >= 0 ? undefined : "linear-gradient(135deg,#991b1b,#dc2626)" }}>
                  <div className="n">{fmtMoney(data.cashFlow.netCashFlow)}</div>
                  <div className="l">{tt("净现金流 (收 − 支)", "Net Cash Flow (Income − Outflow)")}</div>
                </div>
              </div>

              <table>
                <thead>
                  <tr>
                    <th>{tt("收入项目", "Income Item")}</th>
                    <th className="num">{tt("金额", "Amount")}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{tt("房租 Rental", "Rental")}</td>
                    <td className="num">{fmtMoney(data.cashFlow.income.rental)}</td>
                  </tr>
                  <tr>
                    <td>{tt("押金收款 Deposits (押金/水电押/门卡押)", "Deposits (Security/Utilities/Access Card)")}</td>
                    <td className="num">{fmtMoney(data.cashFlow.income.deposits)}</td>
                  </tr>
                  <tr>
                    <td>{tt("其他收费 (Admin Fee/车位/冷气/烘干机/电费/罚款/其他)", "Other Charges (Admin Fee/Carpark/AC/Dryer/Electricity/Late Fee/Other)")}</td>
                    <td className="num">{fmtMoney(data.cashFlow.income.other)}</td>
                  </tr>
                  <tr>
                    <td>
                      <b>{tt("总收入", "Total Income")}</b>
                    </td>
                    <td className="num">
                      <b>{fmtMoney(data.cashFlow.income.total)}</b>
                    </td>
                  </tr>
                </tbody>
              </table>

              <h4>{tt("📑 收入明细 (Income Detail) — 逐笔对账用", "📑 Income Detail — Transaction by Transaction")}</h4>
              {data.cashFlow.transactions.length === 0 ? (
                <p style={{ fontSize: 12.5, color: "#94a3b8", margin: "0 0 10px" }}>{tt("这段时间没有收款记录", "No income records for this period")}</p>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>{tt("交易日期", "Transaction Date")}</th>
                      <th>Room Code</th>
                      <th>Carpark Code</th>
                      <th>{tt("合同", "Contract")}</th>
                      <th>{tt("租客", "Tenant")}</th>
                      <th>{tt("项目", "Item")}</th>
                      <th>{tt("付款方式", "Payment Method")}</th>
                      <th className="num">{tt("金额", "Amount")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.cashFlow.transactions.map((t, i) => (
                      <tr key={i}>
                        <td>
                          <b>{fmtDate(t.paidDate)}</b>
                        </td>
                        <td>{t.roomCode || "-"}</td>
                        <td>{t.carparkCode || "-"}</td>
                        <td>{t.contractCode}</td>
                        <td>{t.tenantName}</td>
                        <td>
                          {t.typeLabel}
                          {t.periodMonth ? ` (${t.periodMonth})` : ""}
                        </td>
                        <td>{t.method || "-"}</td>
                        <td className="num">{fmtMoney(t.amount)}</td>
                      </tr>
                    ))}
                    <tr>
                      <td colSpan={7}>
                        <b>
                          {tt("合计", "Total")} ({data.cashFlow.transactions.length} {tt("笔", "items")})
                        </b>
                      </td>
                      <td className="num">
                        <b>{fmtMoney(data.cashFlow.income.total)}</b>
                      </td>
                    </tr>
                  </tbody>
                </table>
              )}

              <table>
                <thead>
                  <tr>
                    <th>{tt("支出项目 (已确认支付)", "Expense Item (Confirmed Paid)")}</th>
                    <th className="num">{tt("金额", "Amount")}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{tt("Agent 佣金已发", "Agent Commission Paid")}</td>
                    <td className="num">{fmtMoney(data.cashFlow.outflow.commissionPaid)}</td>
                  </tr>
                  <tr>
                    <td>{tt("维修支出已付 (报修工单)", "Maintenance Expenses Paid (Work Orders)")}</td>
                    <td className="num">{fmtMoney(data.cashFlow.outflow.maintenancePaid)}</td>
                  </tr>
                  <tr>
                    <td>{tt("楼盘支出 (水电/Wifi/清洁/维修/其他)", "Property Expenses (Utilities/Wifi/Cleaning/Maintenance/Other)")}</td>
                    <td className="num">{fmtMoney(data.cashFlow.outflow.expensePaid)}</td>
                  </tr>
                  <tr>
                    <td>
                      <b>{tt("总支出", "Total Outflow")}</b>
                    </td>
                    <td className="num">
                      <b>{fmtMoney(data.cashFlow.outflow.total)}</b>
                    </td>
                  </tr>
                </tbody>
              </table>

              {data.cashFlow.expenseTransactions.length > 0 && (
                <>
                  <h4>{tt("📑 支出明细 (Expense Detail) — 逐笔对账用", "📑 Expense Detail — Transaction by Transaction")}</h4>
                  <table>
                    <thead>
                      <tr>
                        <th>{tt("日期", "Date")}</th>
                        <th>{tt("楼盘号", "Property Code")}</th>
                        <th>{tt("楼盘名称", "Property Name")}</th>
                        <th>{tt("类型", "Type")}</th>
                        <th>{tt("备注", "Notes")}</th>
                        <th className="num">{tt("金额", "Amount")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.cashFlow.expenseTransactions.map((e, i) => (
                        <tr key={i}>
                          <td>
                            <b>{fmtDate(e.expenseDate)}</b>
                          </td>
                          <td>
                            <b>{e.propertyCode}</b>
                          </td>
                          <td>{e.propertyName}</td>
                          <td>{e.label}</td>
                          <td>{e.notes || "-"}</td>
                          <td className="num">{fmtMoney(e.amount)}</td>
                        </tr>
                      ))}
                      <tr>
                        <td colSpan={5}>
                          <b>
                            {tt("合计", "Total")} ({data.cashFlow.expenseTransactions.length} {tt("笔", "items")})
                          </b>
                        </td>
                        <td className="num">
                          <b>{fmtMoney(data.cashFlow.outflow.expensePaid)}</b>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </>
              )}

              <h4>{tt("📋 固定应付 (Owner 租金 / Landlord 分成) — 预估, 非已付记录", "📋 Fixed Obligations (Owner Rental / Landlord Share) — Estimated, Not Actual Payment Records")}</h4>
              <p style={{ fontSize: 11.5, color: "#64748b", margin: "0 0 10px" }}>
                {tt(
                  "以下金额是根据楼盘设定算出来的应付义务，不是已确认的实际付款记录 (系统没有单独记录每次付给 Owner/Landlord 的交易)，仅供参考。",
                  "The amounts below are payment obligations calculated from property settings, not confirmed actual payment records (the system does not separately log each payment made to the Owner/Landlord). For reference only."
                )}
              </p>
              <div className="statRow">
                <div className="stat alt">
                  <div className="n">{fmtMoney(data.obligations.ownerRentalObligation)}</div>
                  <div className="l">
                    {tt("应付 Owner 固定租金", "Owner Fixed Rental Payable")} (
                    {data.period === "month" && tt("本月", "This Month")}
                    {data.period === "year" && `${tt("本年", "This Year")} ×${data.obligations.monthsInRange}${tt("个月", " months")}`}
                    {data.period === "all" && tt("当前每月", "Current Monthly")}
                    )
                  </div>
                </div>
                <div className="stat alt">
                  <div className="n">{fmtMoney(data.obligations.landlordPayoutPeriod)}</div>
                  <div className="l">{tt("应付 Landlord 净额 (本期已收 × (1−管理费%))", "Landlord Net Payable (Collected This Period × (1 − Fee %))")}</div>
                </div>
                <div className="stat" style={{ background: "linear-gradient(135deg,#475569,#334155)" }}>
                  <div className="n">{fmtMoney(data.obligations.total)}</div>
                  <div className="l">{tt("固定应付总额", "Total Fixed Obligations")}</div>
                </div>
              </div>

              {data.obligations.masterLeaseProperties.length > 0 && (
                <table>
                  <thead>
                    <tr>
                      <th>{tt("楼盘号", "Property Code")}</th>
                      <th>{tt("楼盘 (整租 Master Lease)", "Property (Master Lease)")}</th>
                      <th>Owner</th>
                      <th className="num">{tt("月租金", "Monthly Rental")}</th>
                      <th className="num">{tt("已付押金", "Deposit Paid")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.obligations.masterLeaseProperties.map((p) => (
                      <tr key={p.propertyCode}>
                        <td>
                          <b>{p.propertyCode}</b>
                        </td>
                        <td>{p.name}</td>
                        <td>{p.landlord || "-"}</td>
                        <td className="num">{fmtMoney(p.ownerRentalAmount)}</td>
                        <td className="num">{p.ownerDeposit !== null ? fmtMoney(p.ownerDeposit) : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {data.obligations.managedProperties.length > 0 && (
                <table>
                  <thead>
                    <tr>
                      <th>{tt("楼盘号", "Property Code")}</th>
                      <th>{tt("楼盘 (代管 Managed)", "Property (Managed)")}</th>
                      <th>Landlord</th>
                      <th className="num">{tt("管理费%", "Fee %")}</th>
                      <th className="num">{tt("本期已收", "Collected This Period")}</th>
                      <th className="num">{tt("应付净额", "Net Payable")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.obligations.managedProperties.map((p) => (
                      <tr key={p.propertyCode}>
                        <td>
                          <b>{p.propertyCode}</b>
                        </td>
                        <td>{p.name}</td>
                        <td>{p.landlord || "-"}</td>
                        <td className="num">{(p.feeRate * 100).toFixed(1)}%</td>
                        <td className="num">{fmtMoney(p.collected)}</td>
                        <td className="num">
                          <b>{fmtMoney(p.payout)}</b>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              <h4>{tt("🏦 押金总览 (Deposits) — 当前实况, 截至今日", "🏦 Deposits Overview — Current Snapshot, As of Today")}</h4>
              <div className="statRow">
                <div className="stat">
                  <div className="n">{fmtMoney(data.deposits.tenant.totalHeld)}</div>
                  <div className="l">
                    {tt("租客押金持有中", "Tenant Deposits Held")} ({data.deposits.tenant.heldContractCount} {tt("份合同", "contracts")})
                  </div>
                </div>
                <div className="stat alt">
                  <div className="n">{fmtMoney(data.deposits.owner.total)}</div>
                  <div className="l">{tt("已付 Owner 押金 (可退还给我们)", "Owner Deposit Paid (Refundable to Us)")}</div>
                </div>
                <div
                  className="stat"
                  style={{
                    background:
                      data.deposits.netExposure >= 0
                        ? "linear-gradient(135deg,#166534,#15803d)"
                        : "linear-gradient(135deg,#991b1b,#dc2626)",
                  }}
                >
                  <div className="n">{fmtMoney(data.deposits.netExposure)}</div>
                  <div className="l">{tt("净押金部位 (Owner 押金 − 租客持有押金)", "Net Deposit Position (Owner Deposit − Tenant Deposits Held)")}</div>
                </div>
              </div>

              <table>
                <thead>
                  <tr>
                    <th>{tt("租客押金类型", "Tenant Deposit Type")}</th>
                    <th className="num">{tt("持有中 (未来要退)", "Held (To Be Refunded)")}</th>
                    <th className="num">{tt("已没收 (终止合同)", "Forfeited (Terminated)")}</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(data.deposits.tenant.byType).map(([type, v]) => (
                    <tr key={type}>
                      <td>{DEPOSIT_TYPE_LABELS[type] ?? type}</td>
                      <td className="num">{fmtMoney(v.held)}</td>
                      <td className="num">{v.forfeited > 0 ? fmtMoney(v.forfeited) : "-"}</td>
                    </tr>
                  ))}
                  <tr>
                    <td>
                      <b>{tt("总计", "Total")}</b>
                    </td>
                    <td className="num">
                      <b>{fmtMoney(data.deposits.tenant.totalHeld)}</b>
                    </td>
                    <td className="num">
                      <b>{data.deposits.tenant.totalForfeited > 0 ? fmtMoney(data.deposits.tenant.totalForfeited) : "-"}</b>
                    </td>
                  </tr>
                </tbody>
              </table>

              {data.deposits.tenant.byProperty.length > 0 && (
                <table>
                  <thead>
                    <tr>
                      <th>{tt("楼盘号", "Property Code")}</th>
                      <th>{tt("按楼盘 — 租客押金持有中", "By Property — Tenant Deposits Held")}</th>
                      <th className="num">{tt("金额", "Amount")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.deposits.tenant.byProperty.map((p) => (
                      <tr key={p.propertyCode}>
                        <td>
                          <b>{p.propertyCode}</b>
                        </td>
                        <td>{p.name}</td>
                        <td className="num">{fmtMoney(p.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
