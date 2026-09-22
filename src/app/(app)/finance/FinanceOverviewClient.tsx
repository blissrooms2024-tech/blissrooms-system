"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { COMPANY, CONTRACT_IMAGES } from "@/lib/config";
import { fmtMoney, fmtDate } from "@/lib/format";
import { useToast } from "@/components/Toast";
import { REPORT_DOC_STYLE } from "@/lib/reportDocStyle";

type Period = "month" | "year" | "all";
const PERIOD_LABELS: Record<Period, string> = { month: "本月", year: "本年", all: "累计" };

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
interface Overview {
  period: Period;
  month: string;
  year: number;
  cashFlow: {
    income: { rental: number; deposits: number; other: number; total: number };
    outflow: { commissionPaid: number; maintenancePaid: number; total: number };
    netCashFlow: number;
    transactions: Transaction[];
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
      byProperty: { name: string; amount: number }[];
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
      setError("出错，请稍后再试");
    }
  }, [period, month, year]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  function printReport() {
    if (!printAreaRef.current) return;
    const html = printAreaRef.current.innerHTML;
    const w = window.open("", "_blank");
    if (!w) {
      toast.warning("浏览器拦截了弹出式窗口，请允许弹窗后再试一次");
      return;
    }
    w.document.write(
      `<html><head><title>财务总览 - Bliss Rooms</title><meta charset="utf-8">` +
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
          <h3 className="text-base font-semibold text-brand">💰 财务总览 — 现金流 & 押金</h3>
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
                  {PERIOD_LABELS[p]}
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
                🖨️ 打印 / 存 PDF
              </button>
            )}
          </div>
        </div>

        {error && <div className="text-sm text-red-600">{error}</div>}
        {!data && !error && <div className="text-sm text-gray-500">载入中...</div>}

        {data && (
          <div ref={printAreaRef}>
            <div className="reportDoc">
              <style>{REPORT_DOC_STYLE}</style>

              <div className="hd">
                <div className="brand">
                  {CONTRACT_IMAGES.logo && <img src={CONTRACT_IMAGES.logo} alt="logo" />}
                  <div>
                    <div className="nm">{COMPANY.NAME}</div>
                    <div className="sub">现金流 & 押金总览</div>
                  </div>
                </div>
                <div className="titleBlock">
                  <div className="title">FINANCE OVERVIEW</div>
                  <div className="titleMeta">
                    {data.period === "month" && `现金流报告月份: ${data.month}`}
                    {data.period === "year" && `现金流报告年份: ${data.year}`}
                    {data.period === "all" && "现金流: 累计 (至今)"}
                    <br />
                    押金: 当前实况 (截至今日)
                  </div>
                </div>
              </div>

              <h4>💵 现金流 (Cash Flow) — {PERIOD_LABELS[data.period]}实际入账/出账</h4>
              <div className="statRow">
                <div className="stat">
                  <div className="n">{fmtMoney(data.cashFlow.income.total)}</div>
                  <div className="l">总收入 (实收)</div>
                </div>
                <div className="stat alt">
                  <div className="n">{fmtMoney(data.cashFlow.outflow.total)}</div>
                  <div className="l">实际支出 (佣金+维修)</div>
                </div>
                <div className="stat" style={{ background: data.cashFlow.netCashFlow >= 0 ? undefined : "linear-gradient(135deg,#991b1b,#dc2626)" }}>
                  <div className="n">{fmtMoney(data.cashFlow.netCashFlow)}</div>
                  <div className="l">净现金流 (收 − 支)</div>
                </div>
              </div>

              <table>
                <thead>
                  <tr>
                    <th>收入项目</th>
                    <th className="num">金额</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>房租 Rental</td>
                    <td className="num">{fmtMoney(data.cashFlow.income.rental)}</td>
                  </tr>
                  <tr>
                    <td>押金收款 Deposits (押金/水电押/门卡押)</td>
                    <td className="num">{fmtMoney(data.cashFlow.income.deposits)}</td>
                  </tr>
                  <tr>
                    <td>其他收费 (Admin Fee/车位/冷气/烘干机/电费/罚款/其他)</td>
                    <td className="num">{fmtMoney(data.cashFlow.income.other)}</td>
                  </tr>
                  <tr>
                    <td>
                      <b>总收入</b>
                    </td>
                    <td className="num">
                      <b>{fmtMoney(data.cashFlow.income.total)}</b>
                    </td>
                  </tr>
                </tbody>
              </table>

              <h4>📑 收入明细 (Income Detail) — 逐笔对账用</h4>
              {data.cashFlow.transactions.length === 0 ? (
                <p style={{ fontSize: 12.5, color: "#94a3b8", margin: "0 0 10px" }}>这段时间没有收款记录</p>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>交易日期</th>
                      <th>Room Code</th>
                      <th>Carpark Code</th>
                      <th>合同</th>
                      <th>租客</th>
                      <th>项目</th>
                      <th>付款方式</th>
                      <th className="num">金额</th>
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
                        <b>合计 ({data.cashFlow.transactions.length} 笔)</b>
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
                    <th>支出项目 (已确认支付)</th>
                    <th className="num">金额</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Agent 佣金已发</td>
                    <td className="num">{fmtMoney(data.cashFlow.outflow.commissionPaid)}</td>
                  </tr>
                  <tr>
                    <td>维修支出已付</td>
                    <td className="num">{fmtMoney(data.cashFlow.outflow.maintenancePaid)}</td>
                  </tr>
                  <tr>
                    <td>
                      <b>总支出</b>
                    </td>
                    <td className="num">
                      <b>{fmtMoney(data.cashFlow.outflow.total)}</b>
                    </td>
                  </tr>
                </tbody>
              </table>

              <h4>📋 固定应付 (Owner 租金 / Landlord 分成) — 预估, 非已付记录</h4>
              <p style={{ fontSize: 11.5, color: "#64748b", margin: "0 0 10px" }}>
                以下金额是根据楼盘设定算出来的应付义务，不是已确认的实际付款记录 (系统没有单独记录每次付给
                Owner/Landlord 的交易)，仅供参考。
              </p>
              <div className="statRow">
                <div className="stat alt">
                  <div className="n">{fmtMoney(data.obligations.ownerRentalObligation)}</div>
                  <div className="l">
                    应付 Owner 固定租金 (
                    {data.period === "month" && "本月"}
                    {data.period === "year" && `本年 ×${data.obligations.monthsInRange}个月`}
                    {data.period === "all" && "当前每月"}
                    )
                  </div>
                </div>
                <div className="stat alt">
                  <div className="n">{fmtMoney(data.obligations.landlordPayoutPeriod)}</div>
                  <div className="l">应付 Landlord 净额 (本期已收 × (1−管理费%))</div>
                </div>
                <div className="stat" style={{ background: "linear-gradient(135deg,#475569,#334155)" }}>
                  <div className="n">{fmtMoney(data.obligations.total)}</div>
                  <div className="l">固定应付总额</div>
                </div>
              </div>

              {data.obligations.masterLeaseProperties.length > 0 && (
                <table>
                  <thead>
                    <tr>
                      <th>楼盘 (整租 Master Lease)</th>
                      <th>Owner</th>
                      <th className="num">月租金</th>
                      <th className="num">已付押金</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.obligations.masterLeaseProperties.map((p) => (
                      <tr key={p.propertyCode}>
                        <td>
                          {p.name} <span style={{ color: "#94a3b8" }}>({p.propertyCode})</span>
                        </td>
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
                      <th>楼盘 (代管 Managed)</th>
                      <th>Landlord</th>
                      <th className="num">管理费%</th>
                      <th className="num">本期已收</th>
                      <th className="num">应付净额</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.obligations.managedProperties.map((p) => (
                      <tr key={p.propertyCode}>
                        <td>
                          {p.name} <span style={{ color: "#94a3b8" }}>({p.propertyCode})</span>
                        </td>
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

              <h4>🏦 押金总览 (Deposits) — 当前实况, 截至今日</h4>
              <div className="statRow">
                <div className="stat">
                  <div className="n">{fmtMoney(data.deposits.tenant.totalHeld)}</div>
                  <div className="l">租客押金持有中 ({data.deposits.tenant.heldContractCount} 份合同)</div>
                </div>
                <div className="stat alt">
                  <div className="n">{fmtMoney(data.deposits.owner.total)}</div>
                  <div className="l">已付 Owner 押金 (可退还给我们)</div>
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
                  <div className="l">净押金部位 (Owner 押金 − 租客持有押金)</div>
                </div>
              </div>

              <table>
                <thead>
                  <tr>
                    <th>租客押金类型</th>
                    <th className="num">持有中 (未来要退)</th>
                    <th className="num">已没收 (终止合同)</th>
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
                      <b>总计</b>
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
                      <th>按楼盘 — 租客押金持有中</th>
                      <th className="num">金额</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.deposits.tenant.byProperty.map((p) => (
                      <tr key={p.name}>
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
