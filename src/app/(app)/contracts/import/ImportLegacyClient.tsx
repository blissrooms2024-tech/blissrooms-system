"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useToast } from "@/components/Toast";
import { useT } from "@/components/LanguageProvider";
import ConfirmDialog from "@/components/ConfirmDialog";

interface RowResult {
  row: number;
  status: "imported" | "skipped" | "error";
  message: string;
}
interface ImportResponse {
  success: boolean;
  message?: string;
  imported?: number;
  total?: number;
  results?: RowResult[];
}

const STATUS_BADGE: Record<string, string> = {
  imported: "bg-green-50 text-green-700",
  skipped: "bg-gray-100 text-gray-500",
  error: "bg-red-50 text-red-700",
};
function statusLabel(status: string, t: (zh: string, en: string) => string): string {
  const map: Record<string, string> = {
    imported: `✅ ${t("已导入", "Imported")}`,
    skipped: `⏭️ ${t("已跳过", "Skipped")}`,
    error: `❌ ${t("出错", "Error")}`,
  };
  return map[status] ?? status;
}

export default function ImportLegacyClient() {
  const toast = useToast();
  const t = useT();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResponse | null>(null);
  const [settling, setSettling] = useState(false);
  const [confirmingSettle, setConfirmingSettle] = useState(false);
  const [settleResult, setSettleResult] = useState<{ message: string; details: string[] } | null>(null);

  async function submit() {
    if (!file) {
      toast.warning(t("请先选一个 Excel 文件", "Please select an Excel file first"));
      return;
    }
    setUploading(true);
    setResult(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/contracts/import-legacy", { method: "POST", body });
      const data: ImportResponse = await res.json();
      if (!data.success) {
        toast.danger(data.message ?? t("导入失败", "Import failed"));
        return;
      }
      setResult(data);
      toast.success(`✅ ${t("导入完成", "Import complete")}: ${data.imported}/${data.total} ${t("成功", "succeeded")}`);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch {
      toast.danger(t("系统出错，请稍后再试", "System error — please try again later"));
    } finally {
      setUploading(false);
    }
  }

  async function runSettle() {
    setConfirmingSettle(false);
    setSettling(true);
    setSettleResult(null);
    try {
      const res = await fetch("/api/contracts/bulk-settle-legacy", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setSettleResult({ message: data.message, details: data.details ?? [] });
      } else {
        toast.danger(data.message);
      }
    } catch {
      toast.danger(t("系统出错，请稍后再试", "System error — please try again later"));
    } finally {
      setSettling(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="rounded-xl bg-white p-5 shadow-sm">
        <div className="mb-3.5 flex items-center justify-between">
          <h3 className="text-base font-semibold text-brand">📥 {t("导入旧合同", "Import Legacy Contracts")}</h3>
          <Link href="/contracts" className="text-sm text-gray-500 hover:underline">
            ← {t("返回合同清单", "Back to Contracts")}
          </Link>
        </div>

        <div className="mb-3.5 rounded-lg bg-brand-light/40 p-3.5 text-sm text-gray-600">
          {t(
            "上传按模板填好的 Excel (.xlsx) 或 CSV (.csv)，系统会自动帮每一行建租客账号(如果还没有)+合同，合同直接设为「生效中」，不需要再走线上签名。上传后旧合同的 PDF 文件还需要到每张合同的详情页个别上传。",
            "Upload an Excel (.xlsx) or CSV (.csv) filled in per the template — the system automatically creates a tenant account (if none exists) plus a contract for each row, and sets the contract straight to \"Active\" without an online signing flow. After upload, each legacy contract's PDF still needs to be uploaded individually on its own detail page."
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="input flex-1"
          />
          <button onClick={submit} disabled={uploading || !file} className="btn-primary">
            {uploading ? t("导入中...", "Importing...") : `⬆️ ${t("上传并导入", "Upload & Import")}`}
          </button>
        </div>
      </div>

      <div className="rounded-xl bg-white p-5 shadow-sm">
        <h3 className="mb-1 text-base font-semibold text-brand">
          🔧 {t("补齐已导入旧合同的已付记录", "Backfill Paid Records for Imported Legacy Contracts")}
        </h3>
        <p className="mb-3.5 text-xs text-gray-400">
          {t(
            "之前导入的旧合同 (还欠款项等于总款、看起来什么都没收过的那些) 一次性补上押金/水电押/Admin Fee/门卡押/第一个月房租/车位租金的已付记录，日期先用 move-in 日期占位，之后再核实。已经补过的合同不会重复补，可以放心点。",
            "For previously-imported legacy contracts (those whose outstanding amount equals the total — i.e. look like nothing was ever collected), this backfills paid records for the Deposit/Utilities Deposit/Admin Fee/Access Card Deposit/first month's rent/carpark rental in one go, using the move-in date as a placeholder date to verify later. Contracts already backfilled won't be backfilled again, so it's safe to run."
          )}
        </p>
        <button onClick={() => setConfirmingSettle(true)} disabled={settling} className="btn-primary">
          {settling ? t("处理中...", "Processing...") : t("立即补齐", "Backfill Now")}
        </button>

        <ConfirmDialog
          open={confirmingSettle}
          message={t(
            "确定现在补齐所有旧合同 (生效中、没有电子签名的) 的已付记录？",
            "Backfill paid records now for all legacy contracts (Active, no digital signature)?"
          )}
          confirmLabel={t("确定补齐", "Confirm Backfill")}
          onConfirm={runSettle}
          onCancel={() => setConfirmingSettle(false)}
        />

        {settleResult && (
          <div className="mt-3.5 rounded-lg bg-gray-50 p-3.5 text-sm">
            <b>{settleResult.message}</b>
            {settleResult.details.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs text-gray-600">
                {settleResult.details.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {result && (
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <h3 className="mb-3.5 text-base font-semibold text-brand">
            {t("导入结果", "Import Result")}: {result.imported}/{result.total} {t("成功", "succeeded")}
          </h3>
          {(!result.results || result.results.length === 0) && (
            <div className="py-6 text-center text-sm text-gray-400">{t("没有读到任何资料行", "No data rows were read")}</div>
          )}
          {result.results && result.results.length > 0 && (
            <div className="space-y-1.5">
              {result.results.map((r) => (
                <div
                  key={r.row}
                  className="flex flex-wrap items-center gap-2.5 border-b border-gray-50 py-2 text-sm last:border-none"
                >
                  <span className="w-16 shrink-0 text-gray-400">{t(`第 ${r.row} 行`, `Row ${r.row}`)}</span>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE[r.status]}`}>
                    {statusLabel(r.status, t)}
                  </span>
                  <span className="text-gray-700">{r.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
