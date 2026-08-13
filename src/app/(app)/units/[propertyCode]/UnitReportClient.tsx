"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { PAYMENT_TYPE_LABELS } from "@/lib/config";
import { fmtMoney } from "@/lib/format";
import { useToast } from "@/components/Toast";

interface Property {
  propertyCode: string;
  name: string;
  address: string | null;
  landlord: string | null;
  managementFeeRate: number | null;
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
        `<style>body{margin:0;padding:34px;font-family:Arial,sans-serif;}table{width:100%;border-collapse:collapse;margin-top:10px;}` +
        `td,th{border:1px solid #999;padding:6px 10px;font-size:13px;text-align:left;}@media print{@page{margin:14mm;}}</style>` +
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
          <div className="mb-4 border-b border-gray-200 pb-3.5">
            <div className="text-lg font-bold text-brand">{report.property.name}</div>
            <div className="text-sm text-gray-500">
              楼盘号: {report.property.propertyCode}
              {report.property.address && ` · ${report.property.address}`}
            </div>
            {report.property.landlord && (
              <div className="mt-1 text-sm text-gray-500">
                Landlord: {report.property.landlord} · 月报月份: {report.month}
              </div>
            )}
            {!report.property.landlord && <div className="mt-1 text-sm text-gray-500">月报月份: {report.month}</div>}
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-gray-600">
                <th className="px-2.5 py-2 font-semibold">房间</th>
                <th className="px-2.5 py-2 font-semibold">租客</th>
                {typeKeys.map((k) => (
                  <th key={k} className="px-2.5 py-2 font-semibold">
                    {PAYMENT_TYPE_LABELS[k]}
                  </th>
                ))}
                <th className="px-2.5 py-2 font-semibold">小计</th>
              </tr>
            </thead>
            <tbody>
              {report.rooms.length === 0 && (
                <tr>
                  <td colSpan={3 + typeKeys.length} className="py-6 text-center text-gray-400">
                    这个楼盘还没有房间
                  </td>
                </tr>
              )}
              {report.rooms.map((r) => (
                <tr key={r.roomCode} className="border-b border-gray-100">
                  <td className="px-2.5 py-1.5">
                    <b>{r.roomCode}</b>
                  </td>
                  <td className="px-2.5 py-1.5">{r.tenantName || "-"}</td>
                  {typeKeys.map((k) => (
                    <td key={k} className="px-2.5 py-1.5">
                      {r.byType[k] ? fmtMoney(r.byType[k]) : "-"}
                    </td>
                  ))}
                  <td className="px-2.5 py-1.5 font-semibold">{fmtMoney(r.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4 flex flex-col items-end gap-1 text-sm">
            <div className="flex w-full max-w-xs justify-between border-t border-gray-200 pt-2">
              <span className="text-gray-600">本月总收</span>
              <b>{fmtMoney(report.total)}</b>
            </div>
            {report.property.landlord && (
              <>
                <div className="flex w-full max-w-xs justify-between">
                  <span className="text-gray-600">
                    管理费 ({report.property.managementFeeRate ? (report.property.managementFeeRate * 100).toFixed(1) : 0}%)
                  </span>
                  <span>- {fmtMoney(report.managementFee)}</span>
                </div>
                <div className="flex w-full max-w-xs justify-between border-t border-gray-200 pt-2 text-base">
                  <span className="font-semibold text-brand">应付 Landlord 净额</span>
                  <b className="text-brand">{fmtMoney(report.netToLandlord ?? 0)}</b>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
