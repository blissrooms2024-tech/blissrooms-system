"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useToast } from "@/components/Toast";
import Lightbox from "@/components/Lightbox";
import StepTimeline, { TimelineStep } from "@/components/StepTimeline";
import { MAINTENANCE_STATUS_LABELS } from "@/lib/config";

interface MaintenanceRow {
  requestCode: string;
  contractCode: string;
  roomCode: string;
  tenantName: string | null;
  title: string;
  description: string | null;
  photos: string[];
  status: string;
  assignedTo: string | null;
  adminNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

const FLOW = ["SUBMITTED", "ACKNOWLEDGED", "IN_PROGRESS", "COMPLETED"];

const NEXT_ACTION: Record<string, { status: string; label: string; color: string } | undefined> = {
  SUBMITTED: { status: "ACKNOWLEDGED", label: "受理", color: "bg-brand" },
  ACKNOWLEDGED: { status: "IN_PROGRESS", label: "开始处理", color: "bg-amber-500" },
  IN_PROGRESS: { status: "COMPLETED", label: "标记完成", color: "bg-green-700" },
};

function buildSteps(r: MaintenanceRow): TimelineStep[] {
  if (r.status === "CANCELLED") {
    return [
      { label: "已提交", sublabel: r.createdAt.slice(0, 10), state: "done" },
      { label: "已取消", sublabel: r.adminNote ?? undefined, state: "rejected" },
    ];
  }
  const currentIndex = FLOW.indexOf(r.status);
  return FLOW.map((s, i) => ({
    label: MAINTENANCE_STATUS_LABELS[s],
    sublabel: i === 0 ? r.createdAt.slice(0, 10) : undefined,
    state: i < currentIndex || (i === currentIndex && s === "COMPLETED") ? "done" : i === currentIndex ? "active" : "pending",
  }));
}

export default function MaintenanceClient({ canAct }: { canAct: boolean }) {
  const toast = useToast();
  const [items, setItems] = useState<MaintenanceRow[] | null>(null);
  const [error, setError] = useState("");
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);
  const [assignedTo, setAssignedTo] = useState<Record<string, string>>({});
  const [adminNote, setAdminNote] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/maintenance");
      const data = await res.json();
      if (!data.success) {
        setError(data.message);
        return;
      }
      setItems(data.requests.map((r: MaintenanceRow & { contract: { contractCode: string } }) => ({ ...r, contractCode: r.contract.contractCode })));
    } catch {
      setError("出错，请稍后再试");
    }
  }, []);

  useEffect(() => {
    // setState happens after the fetch's await, not synchronously in the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function updateStatus(requestCode: string, status: string) {
    const res = await fetch(`/api/maintenance/${requestCode}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, assignedTo: assignedTo[requestCode], adminNote: adminNote[requestCode] }),
    });
    const data = await res.json();
    if (data.success) toast.success(data.message);
    else toast.danger(data.message);
    load();
  }

  if (!items && !error) return <div className="rounded-xl bg-white p-5 text-sm text-gray-500 shadow-sm">载入中...</div>;
  if (error) return <div className="rounded-xl bg-white p-5 text-sm text-red-600 shadow-sm">{error}</div>;

  const open = items!.filter((r) => r.status !== "COMPLETED" && r.status !== "CANCELLED");
  const closed = items!.filter((r) => r.status === "COMPLETED" || r.status === "CANCELLED");

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white p-5 shadow-sm">
        <h3 className="mb-3.5 text-base font-semibold text-brand">🔧 报修管理 — 处理中 ({open.length})</h3>
        {open.length === 0 && <div className="py-8 text-center text-gray-400">🎉 没有待处理的报修</div>}
        <div className="space-y-3">
          {open.map((r) => {
            const next = NEXT_ACTION[r.status];
            return (
              <div key={r.requestCode} className="rounded-lg border border-gray-200 p-3.5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-[220px] flex-1">
                    <div className="text-sm font-semibold">
                      <Link href="/contracts" className="text-brand hover:underline">
                        {r.contractCode}
                      </Link>{" "}
                      · {r.roomCode} · {r.tenantName}
                    </div>
                    <div className="mt-0.5 text-sm">
                      <b>{r.title}</b>
                    </div>
                    {r.description && <div className="text-xs text-gray-500">{r.description}</div>}
                    {r.photos.length > 0 && (
                      <div className="mt-1.5 flex gap-2">
                        {r.photos.map((p, i) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            key={i}
                            src={p}
                            alt=""
                            onClick={() => setZoomUrl(p)}
                            className="h-14 w-14 cursor-pointer rounded-lg border border-gray-200 object-cover hover:opacity-90"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="w-full sm:w-auto sm:min-w-[160px]">
                    <StepTimeline steps={buildSteps(r)} />
                  </div>
                </div>
                {canAct && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-gray-100 pt-2.5">
                    <input
                      className="input w-[130px] text-xs"
                      placeholder="处理人 (可选)"
                      defaultValue={r.assignedTo ?? ""}
                      onChange={(e) => setAssignedTo((m) => ({ ...m, [r.requestCode]: e.target.value }))}
                    />
                    <input
                      className="input min-w-[160px] flex-1 text-xs"
                      placeholder="备注 (可选)"
                      defaultValue={r.adminNote ?? ""}
                      onChange={(e) => setAdminNote((m) => ({ ...m, [r.requestCode]: e.target.value }))}
                    />
                    {next && (
                      <button
                        onClick={() => updateStatus(r.requestCode, next.status)}
                        className={`rounded-md ${next.color} px-3 py-1.5 text-xs font-semibold text-white`}
                      >
                        {next.label}
                      </button>
                    )}
                    <button
                      onClick={() => updateStatus(r.requestCode, "CANCELLED")}
                      className="rounded-md bg-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600"
                    >
                      取消
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {closed.length > 0 && (
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <h3 className="mb-3.5 text-base font-semibold text-gray-500">📁 已结束 ({closed.length})</h3>
          <div className="space-y-2">
            {closed.map((r) => (
              <div key={r.requestCode} className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-50 py-2 text-sm last:border-none">
                <div>
                  <b>{r.contractCode}</b> · {r.roomCode} · {r.title}
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    r.status === "COMPLETED" ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {MAINTENANCE_STATUS_LABELS[r.status] ?? r.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {zoomUrl && <Lightbox src={zoomUrl} alt="报修照片" onClose={() => setZoomUrl(null)} />}
    </div>
  );
}
