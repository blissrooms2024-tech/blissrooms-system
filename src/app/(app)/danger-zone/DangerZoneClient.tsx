"use client";

import { useEffect, useState, useCallback } from "react";
import { useToast } from "@/components/Toast";

interface Counts {
  users: number;
  properties: number;
  rooms: number;
  contracts: number;
  payments: number;
  commissions: number;
  moveForms: number;
  maintenance: number;
  warningLetters: number;
  logs: number;
}

const CONFIRM_PHRASE = "DELETE ALL";

const COUNT_LABELS: Record<keyof Counts, string> = {
  users: "用户 (不含 Admin)",
  properties: "楼盘",
  rooms: "房间",
  contracts: "合同",
  payments: "收款/账单记录",
  commissions: "佣金记录",
  moveForms: "Move-in/out 表格",
  maintenance: "报修记录",
  warningLetters: "警告信记录",
  logs: "系统日志",
};

export default function DangerZoneClient() {
  const toast = useToast();
  const [counts, setCounts] = useState<Counts | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [exporting, setExporting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [done, setDone] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/danger-zone/summary");
    const data = await res.json();
    if (data.success) setCounts(data.counts);
  }, []);

  useEffect(() => {
    // setState happens after the fetch's await, not synchronously in the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function exportBackup() {
    setExporting(true);
    try {
      const res = await fetch("/api/admin/danger-zone/export");
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `blissrooms-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("✅ 备份已下载");
    } catch {
      toast.danger("备份下载失败，请稍后再试");
    } finally {
      setExporting(false);
    }
  }

  async function reset() {
    if (confirmText !== CONFIRM_PHRASE) return;
    setResetting(true);
    try {
      const res = await fetch("/api/admin/danger-zone/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmText }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setDone(true);
        setConfirmText("");
        load();
      } else {
        toast.danger(data.message);
      }
    } catch {
      toast.danger("系统出错，请稍后再试");
    } finally {
      setResetting(false);
    }
  }

  const totalRows = counts ? Object.values(counts).reduce((s, n) => s + n, 0) : null;

  return (
    <div className="mx-auto max-w-2xl rounded-xl border-2 border-red-200 bg-white p-5 shadow-sm">
      <h3 className="mb-1 text-base font-semibold text-red-700">☢️ Danger Zone — 清空所有资料</h3>
      <p className="mb-3.5 text-xs text-gray-500">
        这个操作会永久删除底下所有资料，只保留现有的 Admin 登入账号。删除后无法恢复，请先确认没有还需要的资料，或先下载备份。
      </p>

      {done && (
        <div className="mb-3.5 rounded-lg bg-green-50 px-3.5 py-2.5 text-sm text-green-700">
          ✅ 已清空所有资料，现在只剩下 Admin 账号，可以开始输入真实资料了。
        </div>
      )}

      <div className="mb-3.5 rounded-lg border border-gray-200 p-3.5">
        <b className="mb-2 block text-sm">现在数据库里有:</b>
        {!counts ? (
          <div className="text-sm text-gray-400">载入中...</div>
        ) : totalRows === 0 ? (
          <div className="text-sm text-gray-400">数据库已经是空的了</div>
        ) : (
          <ul className="space-y-1 text-sm text-gray-600">
            {(Object.keys(COUNT_LABELS) as (keyof Counts)[]).map(
              (k) =>
                counts[k] > 0 && (
                  <li key={k}>
                    {COUNT_LABELS[k]}: <b>{counts[k]}</b>
                  </li>
                )
            )}
          </ul>
        )}
      </div>

      <button
        type="button"
        onClick={exportBackup}
        disabled={exporting}
        className="mb-3.5 w-full rounded-lg bg-gray-100 px-3.5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-200 disabled:opacity-50"
      >
        {exporting ? "下载中..." : "📥 先下载备份 (JSON)"}
      </button>

      <div className="rounded-lg bg-red-50 p-3.5">
        <label className="mb-1.5 block text-sm font-semibold text-red-700">
          输入「{CONFIRM_PHRASE}」来确认清空 (区分大小写)
        </label>
        <input
          className="input mb-2.5 border-red-300"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder={CONFIRM_PHRASE}
        />
        <button
          type="button"
          onClick={reset}
          disabled={confirmText !== CONFIRM_PHRASE || resetting || totalRows === 0}
          className="w-full rounded-lg bg-red-600 px-3.5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40"
        >
          {resetting ? "清空中..." : "🗑️ 永久清空所有资料"}
        </button>
      </div>
    </div>
  );
}
