"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { COMPANY, CONTRACT_IMAGES, PAYMENT_TYPE_LABELS, EXPENSE_CATEGORY_LABELS } from "@/lib/config";
import { fmtMoney, fmtDate } from "@/lib/format";
import { useToast } from "@/components/Toast";
import ConfirmDialog from "@/components/ConfirmDialog";
import { REPORT_DOC_STYLE } from "@/lib/reportDocStyle";

interface Property {
  propertyCode: string;
  name: string;
  address: string | null;
  landlord: string | null;
  managementFeeRate: number | null;
  ownerRentalAmount: number | null;
}
interface RoomRow {
  roomCode: string;
  tenantName: string | null;
  byType: Record<string, number>;
  total: number;
}
interface ExpenseItem {
  expenseCode: string;
  category: string;
  label: string;
  amount: number;
  expenseDate: string;
  notes: string | null;
  recordedBy: string;
}
interface MaintenanceItem {
  requestCode: string;
  roomCode: string;
  title: string;
  amount: number;
  costPaidAt: string;
}
interface Report {
  property: Property;
  month: string;
  rooms: RoomRow[];
  byType: Record<string, number>;
  total: number;
  expenses: { items: ExpenseItem[]; total: number };
  maintenance: { items: MaintenanceItem[]; total: number };
  totalExpenses: number;
  managementFee: number;
  netToLandlord: number | null;
  netProfit: number | null;
}

const EXPENSE_CATEGORIES = ["WATER", "ELECTRIC", "WIFI", "CLEANING", "MAINTENANCE", "OTHER"] as const;

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function UnitReportClient({ propertyCode, role }: { propertyCode: string; role: string }) {
  const toast = useToast();
  const [month, setMonth] = useState(currentMonth());
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const printAreaRef = useRef<HTMLDivElement>(null);

  const [addingExpense, setAddingExpense] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    category: "WATER" as (typeof EXPENSE_CATEGORIES)[number],
    customLabel: "",
    amount: "",
    expenseDate: today(),
    periodMonth: currentMonth(),
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [deletingCode, setDeletingCode] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch(`/api/properties/${propertyCode}/report?month=${month}`);
      const data = await res.json();
      if (!data.success) {
        setError(data.message);
        return;
      }
      setReport(data);
    } catch {
      setError("出错，请稍后再试");
    }
  }, [propertyCode, month]);

  useEffect(() => {
    // setState happens after the fetch's await, not synchronously in the effect body.
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
      `<html><head><title>楼盘月报 - ${propertyCode}</title><meta charset="utf-8">` +
        `<style>body{margin:0;padding:34px;max-width:820px;margin:auto;}@media print{@page{margin:14mm;}}</style>` +
        `</head><body>${html}</body></html>`
    );
    w.document.close();
    setTimeout(() => w.print(), 400);
  }

  async function submitExpense() {
    if (!expenseForm.amount || Number(expenseForm.amount) <= 0) {
      toast.warning("请填金额");
      return;
    }
    if (expenseForm.category === "OTHER" && !expenseForm.customLabel.trim()) {
      toast.warning("「其他」类型要填支出名称");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyCode, ...expenseForm }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setExpenseForm((f) => ({ ...f, amount: "", customLabel: "", notes: "" }));
        setAddingExpense(false);
        load();
      } else {
        toast.danger(data.message);
      }
    } catch {
      toast.danger("系统出错，请稍后再试");
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDeleteExpense() {
    if (!deletingCode) return;
    const code = deletingCode;
    setDeletingCode(null);
    const res = await fetch(`/api/expenses/${code}`, { method: "DELETE" });
    const data = await res.json();
    if (data.success) toast.success(data.message);
    else toast.danger(data.message);
    load();
  }

  const typeKeys = report ? Object.keys(PAYMENT_TYPE_LABELS).filter((k) => report.byType[k]) : [];
  const canManageExpenses = role === "ADMIN";
  const neitherManagedNorLeased =
    report && report.property.managementFeeRate === null && report.property.ownerRentalAmount === null;

  return (
    <div className="rounded-xl bg-white p-5 shadow-sm">
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2.5 no-print">
        <h3 className="text-base font-semibold text-brand">📊 楼盘月报 — {propertyCode}</h3>
        <div className="flex items-center gap-2.5">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
          />
          {canManageExpenses && (
            <button
              onClick={() => {
                if (!addingExpense) setExpenseForm((f) => ({ ...f, periodMonth: month }));
                setAddingExpense((v) => !v);
              }}
              className="rounded-lg bg-amber-600 px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-amber-700"
            >
              ➕ 登记支出
            </button>
          )}
          {report && (
            <button onClick={printReport} className="rounded-lg bg-green-700 px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-green-800">
              🖨️ 打印 / 存 PDF
            </button>
          )}
        </div>
      </div>

      {canManageExpenses && addingExpense && (
        <div className="no-print mb-3.5 flex flex-wrap items-end gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <div className="min-w-[110px]">
            <label className="mb-1.5 block text-sm text-gray-600">类型</label>
            <select
              className="input"
              value={expenseForm.category}
              onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value as typeof expenseForm.category })}
            >
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {EXPENSE_CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </div>
          {expenseForm.category === "OTHER" && (
            <div className="min-w-[110px]">
              <label className="mb-1.5 block text-sm text-gray-600">支出名称</label>
              <input
                className="input"
                placeholder="例: 灭虫费"
                value={expenseForm.customLabel}
                onChange={(e) => setExpenseForm({ ...expenseForm, customLabel: e.target.value })}
              />
            </div>
          )}
          <div className="min-w-[100px]">
            <label className="mb-1.5 block text-sm text-gray-600">金额 RM</label>
            <input
              type="number"
              className="input"
              value={expenseForm.amount}
              onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
            />
          </div>
          <div className="min-w-[130px]">
            <label className="mb-1.5 block text-sm text-gray-600">支出日期</label>
            <input
              type="date"
              className="input"
              value={expenseForm.expenseDate}
              onChange={(e) => setExpenseForm({ ...expenseForm, expenseDate: e.target.value })}
            />
          </div>
          <div className="min-w-[120px]">
            <label className="mb-1.5 block text-sm text-gray-600">算入哪个月份</label>
            <input
              type="month"
              className="input"
              value={expenseForm.periodMonth}
              onChange={(e) => setExpenseForm({ ...expenseForm, periodMonth: e.target.value })}
            />
          </div>
          <div className="min-w-[140px] flex-1">
            <label className="mb-1.5 block text-sm text-gray-600">备注 (选填)</label>
            <input
              className="input"
              value={expenseForm.notes}
              onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })}
            />
          </div>
          <button onClick={submitExpense} disabled={submitting} className="btn-primary">
            {submitting ? "登记中..." : "登记"}
          </button>
        </div>
      )}

      {error && <div className="text-sm text-red-600">{error}</div>}
      {!report && !error && <div className="text-sm text-gray-500">载入中...</div>}

      {report && (
        <div ref={printAreaRef}>
        <div className="reportDoc">
          <style>{REPORT_DOC_STYLE}</style>

          <div className="hd">
            <div className="brand">
              {CONTRACT_IMAGES.logo && <img src={CONTRACT_IMAGES.logo} alt="logo" />}
              <div>
                <div className="nm">{COMPANY.NAME}</div>
                <div className="sub">
                  {report.property.name} · 楼盘号: {report.property.propertyCode}
                  {report.property.address && ` · ${report.property.address}`}
                </div>
              </div>
            </div>
            <div className="titleBlock">
              <div className="title">PROPERTY REPORT</div>
              <div className="titleMeta">
                {report.property.landlord && (
                  <>
                    {report.property.ownerRentalAmount !== null ? "Owner" : "Landlord"}: {report.property.landlord}
                    <br />
                  </>
                )}
                月报月份: {report.month}
              </div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>房间</th>
                <th>租客</th>
                {typeKeys.map((k) => (
                  <th key={k} className="num">
                    {PAYMENT_TYPE_LABELS[k]}
                  </th>
                ))}
                <th className="num">小计</th>
              </tr>
            </thead>
            <tbody>
              {report.rooms.length === 0 && (
                <tr>
                  <td colSpan={3 + typeKeys.length} className="empty">
                    这个楼盘还没有房间
                  </td>
                </tr>
              )}
              {report.rooms.map((r) => (
                <tr key={r.roomCode}>
                  <td>
                    <b>{r.roomCode}</b>
                  </td>
                  <td>{r.tenantName || "-"}</td>
                  {typeKeys.map((k) => (
                    <td key={k} className="num">
                      {r.byType[k] ? fmtMoney(r.byType[k]) : "-"}
                    </td>
                  ))}
                  <td className="num">
                    <b>{fmtMoney(r.total)}</b>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {(report.expenses.items.length > 0 || report.maintenance.items.length > 0) && (
            <>
              <h4>💸 本月支出 Expenses</h4>
              <table>
                <thead>
                  <tr>
                    <th>日期</th>
                    <th>类型</th>
                    <th>备注</th>
                    <th className="num">金额</th>
                    {canManageExpenses && <th className="num no-print"> </th>}
                  </tr>
                </thead>
                <tbody>
                  {report.maintenance.items.map((m) => (
                    <tr key={m.requestCode}>
                      <td>{fmtDate(m.costPaidAt)}</td>
                      <td>维修 (报修工单 {m.requestCode})</td>
                      <td>
                        {m.roomCode} · {m.title}
                      </td>
                      <td className="num">{fmtMoney(m.amount)}</td>
                      {canManageExpenses && <td className="no-print"></td>}
                    </tr>
                  ))}
                  {report.expenses.items.map((e) => (
                    <tr key={e.expenseCode}>
                      <td>{fmtDate(e.expenseDate)}</td>
                      <td>{e.label}</td>
                      <td>{e.notes || "-"}</td>
                      <td className="num">{fmtMoney(e.amount)}</td>
                      {canManageExpenses && (
                        <td className="num no-print">
                          <button
                            onClick={() => setDeletingCode(e.expenseCode)}
                            className="text-xs font-semibold text-red-600 hover:underline"
                          >
                            删除
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={canManageExpenses ? 4 : 3}>
                      <b>支出总额</b>
                    </td>
                    <td className="num">
                      <b>{fmtMoney(report.totalExpenses)}</b>
                    </td>
                  </tr>
                </tbody>
              </table>
            </>
          )}

          <div className="summary">
            <div className="row">
              <span>本月总收</span>
              <b>{fmtMoney(report.total)}</b>
            </div>
            {report.totalExpenses > 0 && (
              <div className="row">
                <span>支出 Expenses</span>
                <span className="neg">- {fmtMoney(report.totalExpenses)}</span>
              </div>
            )}
            {report.property.managementFeeRate !== null && (
              <>
                <div className="row">
                  <span>管理费 ({(report.property.managementFeeRate * 100).toFixed(1)}%)</span>
                  <span className="neg">- {fmtMoney(report.managementFee)}</span>
                </div>
                <div className="total">
                  <span>应付 Landlord 净额</span>
                  <span className={(report.netToLandlord ?? 0) < 0 ? "neg" : ""}>{fmtMoney(report.netToLandlord ?? 0)}</span>
                </div>
              </>
            )}
            {report.property.ownerRentalAmount !== null && (
              <>
                <div className="row">
                  <span>付 Owner 租金</span>
                  <span className="neg">- {fmtMoney(report.property.ownerRentalAmount)}</span>
                </div>
                <div className="total">
                  <span>本月净利</span>
                  <span className={(report.netProfit ?? 0) < 0 ? "neg" : ""}>{fmtMoney(report.netProfit ?? 0)}</span>
                </div>
              </>
            )}
            {neitherManagedNorLeased && report.totalExpenses > 0 && (
              <div className="total">
                <span>净额 (扣除支出)</span>
                <span className={report.total - report.totalExpenses < 0 ? "neg" : ""}>
                  {fmtMoney(report.total - report.totalExpenses)}
                </span>
              </div>
            )}
          </div>
        </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deletingCode}
        danger
        message="确定删除这笔支出记录？这个操作不能撤销。"
        confirmLabel="确定删除"
        onConfirm={confirmDeleteExpense}
        onCancel={() => setDeletingCode(null)}
      />
    </div>
  );
}
