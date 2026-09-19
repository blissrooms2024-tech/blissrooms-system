"use client";

import { useEffect, useRef, useState, use } from "react";
import InvoiceDocument, { InvoiceData } from "@/components/InvoiceDocument";
import { useToast } from "@/components/Toast";

export default function InvoicePage({ params }: { params: Promise<{ paymentCode: string }> }) {
  const { paymentCode } = use(params);
  const toast = useToast();
  const [inv, setInv] = useState<InvoiceData | null>(null);
  const [error, setError] = useState("");
  const printAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/invoice/${paymentCode}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.success) {
          setError(data.message);
          return;
        }
        setInv(data.invoice);
      })
      .catch(() => setError("出错，请稍后再试"));
  }, [paymentCode]);

  function print() {
    if (!printAreaRef.current) return;
    const html = printAreaRef.current.innerHTML;
    const w = window.open("", "_blank");
    if (!w) {
      toast.warning("浏览器拦截了弹出式窗口，请允许弹窗后再试一次");
      return;
    }
    w.document.write(
      `<html><head><title>Invoice - Bliss Rooms</title><meta charset="utf-8">` +
        `<style>body{margin:0;padding:34px;max-width:820px;margin:auto;}@media print{@page{margin:14mm;}}</style>` +
        `</head><body>${html}</body></html>`
    );
    w.document.close();
    setTimeout(() => w.print(), 400);
  }

  return (
    <div className="rounded-xl bg-white p-5 shadow-sm">
      {error && <div className="text-sm text-red-600">{error}</div>}
      {!inv && !error && <div className="text-sm text-gray-500">载入中...</div>}
      {inv && (
        <>
          <div className="mb-3 text-right no-print">
            <button onClick={print} className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800">
              🖨️ 打印 / 存 PDF
            </button>
          </div>
          <div ref={printAreaRef}>
            <InvoiceDocument inv={inv} />
          </div>
        </>
      )}
    </div>
  );
}
