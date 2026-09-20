"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { COMPANY, CONTRACT_IMAGES, PAYMENT_TYPE_LABELS } from "@/lib/config";
import { fmtMoney } from "@/lib/format";
import { useToast } from "@/components/Toast";
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
interface Report {
  property: Property;
  month: string;
  rooms: RoomRow[];
  byType: Record<string, number>;
  total: number;
  managementFee: number;
  netToLandlord: number | null;
  netProfit: number | null;
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export default function UnitReportClient({ propertyCode }: { propertyCode: string }) {
  const toast = useToast();
  const [month, setMonth] = useState(currentMonth());
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const printAreaRef = useRef<HTMLDivElement>(null);

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

  const typeKeys = report ? Object.keys(PAYMENT_TYPE_LABELS).filter((k) => report.byType[k]) : [];

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
          {report && (
            <button onClick={printReport} className="rounded-lg bg-green-700 px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-green-800">
              🖨️ 打印 / 存 PDF
            </button>
          )}
        </div>
      </div>

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

          <div className="summary">
            <div className="row">
              <span>本月总收</span>
              <b>{fmtMoney(report.total)}</b>
            </div>
            {report.property.managementFeeRate !== null && (
              <>
                <div className="row">
                  <span>管理费 ({(report.property.managementFeeRate * 100).toFixed(1)}%)</span>
                  <span className="neg">- {fmtMoney(report.managementFee)}</span>
                </div>
                <div className="total">
                  <span>应付 Landlord 净额</span>
                  <span>{fmtMoney(report.netToLandlord ?? 0)}</span>
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
          </div>
        </div>
        </div>
      )}
    </div>
  );
}
