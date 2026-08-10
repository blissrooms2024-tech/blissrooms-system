"use client";

import { useEffect, useRef, useState, use } from "react";
import AgreementDocument, { AgreementContract } from "@/components/AgreementDocument";

export default function AgreementPage({ params }: { params: Promise<{ contractId: string }> }) {
  const { contractId } = use(params);
  const [contract, setContract] = useState<AgreementContract | null>(null);
  const [error, setError] = useState("");
  const printAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/contracts/${contractId}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.success) {
          setError(data.message);
          return;
        }
        setContract(data.contract);
      })
      .catch(() => setError("出错，请稍后再试"));
  }, [contractId]);

  function printContract() {
    if (!printAreaRef.current) return;
    const html = printAreaRef.current.innerHTML;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(
      `<html><head><title>Tenancy Agreement - Bliss Rooms</title><meta charset="utf-8">` +
        `<style>body{margin:0;padding:34px;max-width:820px;margin:auto;}@media print{@page{margin:14mm;}}</style>` +
        `</head><body>${html}</body></html>`
    );
    w.document.close();
    setTimeout(() => w.print(), 400);
  }

  return (
    <div className="rounded-xl bg-white p-5 shadow-sm">
      {error && <div className="text-sm text-red-600">{error}</div>}
      {!contract && !error && <div className="text-sm text-gray-500">载入中...</div>}
      {contract && (
        <>
          <div className="mb-3 text-right no-print">
            <button onClick={printContract} className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800">
              🖨️ 打印 / 存 PDF
            </button>
          </div>
          <div ref={printAreaRef}>
            <AgreementDocument c={contract} />
          </div>
        </>
      )}
    </div>
  );
}
