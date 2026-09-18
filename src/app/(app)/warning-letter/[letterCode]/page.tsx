"use client";

import { useEffect, useRef, useState, use } from "react";
import WarningLetterDocument, { WarningLetterData } from "@/components/WarningLetterDocument";
import { useToast } from "@/components/Toast";

export default function WarningLetterPage({ params }: { params: Promise<{ letterCode: string }> }) {
  const { letterCode } = use(params);
  const toast = useToast();
  const [letter, setLetter] = useState<WarningLetterData | null>(null);
  const [error, setError] = useState("");
  const printAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/warning-letter/${letterCode}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.success) {
          setError(data.message);
          return;
        }
        setLetter(data.letter);
      })
      .catch(() => setError("出错，请稍后再试"));
  }, [letterCode]);

  function printLetter() {
    if (!printAreaRef.current) return;
    const html = printAreaRef.current.innerHTML;
    const w = window.open("", "_blank");
    if (!w) {
      toast.warning("浏览器拦截了弹出式窗口，请允许弹窗后再试一次");
      return;
    }
    w.document.write(
      `<html><head><title>Warning Letter - Bliss Rooms</title><meta charset="utf-8">` +
        `<style>body{margin:0;padding:34px;max-width:820px;margin:auto;}@media print{@page{margin:14mm;}}</style>` +
        `</head><body>${html}</body></html>`
    );
    w.document.close();
    setTimeout(() => w.print(), 400);
  }

  return (
    <div className="rounded-xl bg-white p-5 shadow-sm">
      {error && <div className="text-sm text-red-600">{error}</div>}
      {!letter && !error && <div className="text-sm text-gray-500">载入中...</div>}
      {letter && (
        <>
          <div className="mb-3 text-right no-print">
            <button onClick={printLetter} className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800">
              🖨️ 打印 / 存 PDF
            </button>
          </div>
          <div ref={printAreaRef}>
            <WarningLetterDocument l={letter} />
          </div>
        </>
      )}
    </div>
  );
}
