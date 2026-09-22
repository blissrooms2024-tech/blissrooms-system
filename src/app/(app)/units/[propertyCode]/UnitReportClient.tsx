"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  COMPANY,
  CONTRACT_IMAGES,
  PAYMENT_TYPE_LABELS,
  paymentTypeLabelLocale,
  expenseCategoryLabelLocale,
} from "@/lib/config";
import { fmtMoney, fmtDate } from "@/lib/format";
import { useToast } from "@/components/Toast";
import { useLanguage } from "@/components/LanguageProvider";
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
  const { locale, t } = useLanguage();
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
      setError(t("出错，请稍后再试", "Something went wrong — please try again later"));
    }
  }, [propertyCode, month, t]);

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
      toast.warning(t("浏览器拦截了弹出式窗口，请允许弹窗后再试一次", "Your browser blocked the pop-up window — please allow pop-ups and try again"));
      return;
    }
    w.document.write(
      `<html><head><title>${t("楼盘月报", "Property Monthly Report")} - ${propertyCode}</title><meta charset="utf-8">` +
        `<style>body{margin:0;padding:34px;max-width:820px;margin:auto;}@media print{@page{margin:14mm;}}</style>` +
        `</head><body>${html}</body></html>`
    );
    w.document.close();
    setTimeout(() => w.print(), 400);
  }

  async function submitExpense() {
    if (!expenseForm.amount || Number(expenseForm.amount) <= 0) {
      toast.warning(t("请填金额", "Please enter an amount"));
      return;
    }
    if (expenseForm.category === "OTHER" && !expenseForm.customLabel.trim()) {
      toast.warning(t("「其他」类型要填支出名称", "Please enter an expense name for the \"Other\" category"));
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
      toast.danger(t("系统出错，请稍后再试", "System error — please try again later"));
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
        <h3 className="text-base font-semibold text-brand">
          {t("📊 楼盘月报", "📊 Property Monthly Report")} — {propertyCode}
        </h3>
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
              {t("➕ 登记支出", "➕ Record Expense")}
            </button>
          )}
          {report && (
            <button onClick={printReport} className="rounded-lg bg-green-700 px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-green-800">
              {t("🖨️ 打印 / 存 PDF", "🖨️ Print / Save as PDF")}
            </button>
          )}
        </div>
      </div>

      {canManageExpenses && addingExpense && (
        <div className="no-print mb-3.5 flex flex-wrap items-end gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <div className="min-w-[110px]">
            <label className="mb-1.5 block text-sm text-gray-600">{t("类型", "Type")}</label>
            <select
              className="input"
              value={expenseForm.category}
              onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value as typeof expenseForm.category })}
            >
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {expenseCategoryLabelLocale(c, undefined, locale)}
                </option>
              ))}
            </select>
          </div>
          {expenseForm.category === "OTHER" && (
            <div className="min-w-[110px]">
              <label className="mb-1.5 block text-sm text-gray-600">{t("支出名称", "Expense Name")}</label>
              <input
                className="input"
                placeholder={t("例: 灭虫费", "e.g. Pest control fee")}
                value={expenseForm.customLabel}
                onChange={(e) => setExpenseForm({ ...expenseForm, customLabel: e.target.value })}
              />
            </div>
          )}
          <div className="min-w-[100px]">
            <label className="mb-1.5 block text-sm text-gray-600">{t("金额 RM", "Amount RM")}</label>
            <input
              type="number"
              className="input"
              value={expenseForm.amount}
              onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
            />
          </div>
          <div className="min-w-[130px]">
            <label className="mb-1.5 block text-sm text-gray-600">{t("支出日期", "Expense Date")}</label>
            <input
              type="date"
              className="input"
              value={expenseForm.expenseDate}
              onChange={(e) => setExpenseForm({ ...expenseForm, expenseDate: e.target.value })}
            />
          </div>
          <div className="min-w-[120px]">
            <label className="mb-1.5 block text-sm text-gray-600">{t("算入哪个月份", "Counted Toward Month")}</label>
            <input
              type="month"
              className="input"
              value={expenseForm.periodMonth}
              onChange={(e) => setExpenseForm({ ...expenseForm, periodMonth: e.target.value })}
            />
          </div>
          <div className="min-w-[140px] flex-1">
            <label className="mb-1.5 block text-sm text-gray-600">{t("备注 (选填)", "Notes (optional)")}</label>
            <input
              className="input"
              value={expenseForm.notes}
              onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })}
            />
          </div>
          <button onClick={submitExpense} disabled={submitting} className="btn-primary">
            {submitting ? t("登记中...", "Recording...") : t("登记", "Record")}
          </button>
        </div>
      )}

      {error && <div className="text-sm text-red-600">{error}</div>}
      {!report && !error && <div className="text-sm text-gray-500">{t("载入中...", "Loading...")}</div>}

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
                  {report.property.name} · {t("楼盘号", "Property Code")}: {report.property.propertyCode}
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
                {t("月报月份", "Report Month")}: {report.month}
              </div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>{t("房间", "Room")}</th>
                <th>{t("租客", "Tenant")}</th>
                {typeKeys.map((k) => (
                  <th key={k} className="num">
                    {paymentTypeLabelLocale(k, null, locale)}
                  </th>
                ))}
                <th className="num">{t("小计", "Subtotal")}</th>
              </tr>
            </thead>
            <tbody>
              {report.rooms.length === 0 && (
                <tr>
                  <td colSpan={3 + typeKeys.length} className="empty">
                    {t("这个楼盘还没有房间", "This property has no rooms yet")}
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
              <h4>{t("💸 本月支出 Expenses", "💸 Monthly Expenses")}</h4>
              <table>
                <thead>
                  <tr>
                    <th>{t("日期", "Date")}</th>
                    <th>{t("类型", "Type")}</th>
                    <th>{t("备注", "Notes")}</th>
                    <th className="num">{t("金额", "Amount")}</th>
                    {canManageExpenses && <th className="num no-print"> </th>}
                  </tr>
                </thead>
                <tbody>
                  {report.maintenance.items.map((m) => (
                    <tr key={m.requestCode}>
                      <td>{fmtDate(m.costPaidAt)}</td>
                      <td>
                        {t("维修 (报修工单", "Maintenance (Ticket")} {m.requestCode})
                      </td>
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
                            {t("删除", "Delete")}
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={canManageExpenses ? 4 : 3}>
                      <b>{t("支出总额", "Total Expenses")}</b>
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
              <span>{t("本月总收", "Total Income This Month")}</span>
              <b>{fmtMoney(report.total)}</b>
            </div>
            {report.totalExpenses > 0 && (
              <div className="row">
                <span>{t("支出 Expenses", "Expenses")}</span>
                <span className="neg">- {fmtMoney(report.totalExpenses)}</span>
              </div>
            )}
            {report.property.managementFeeRate !== null && (
              <>
                <div className="row">
                  <span>
                    {t("管理费", "Management Fee")} ({(report.property.managementFeeRate * 100).toFixed(1)}%)
                  </span>
                  <span className="neg">- {fmtMoney(report.managementFee)}</span>
                </div>
                <div className="total">
                  <span>{t("应付 Landlord 净额", "Net Amount Payable to Landlord")}</span>
                  <span className={(report.netToLandlord ?? 0) < 0 ? "neg" : ""}>{fmtMoney(report.netToLandlord ?? 0)}</span>
                </div>
              </>
            )}
            {report.property.ownerRentalAmount !== null && (
              <>
                <div className="row">
                  <span>{t("付 Owner 租金", "Rent Paid to Owner")}</span>
                  <span className="neg">- {fmtMoney(report.property.ownerRentalAmount)}</span>
                </div>
                <div className="total">
                  <span>{t("本月净利", "Net Profit This Month")}</span>
                  <span className={(report.netProfit ?? 0) < 0 ? "neg" : ""}>{fmtMoney(report.netProfit ?? 0)}</span>
                </div>
              </>
            )}
            {neitherManagedNorLeased && report.totalExpenses > 0 && (
              <div className="total">
                <span>{t("净额 (扣除支出)", "Net Amount (After Expenses)")}</span>
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
        message={t("确定删除这笔支出记录？这个操作不能撤销。", "Are you sure you want to delete this expense record? This action cannot be undone.")}
        confirmLabel={t("确定删除", "Confirm Delete")}
        onConfirm={confirmDeleteExpense}
        onCancel={() => setDeletingCode(null)}
      />
    </div>
  );
}
