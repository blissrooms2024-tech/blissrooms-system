"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useToast } from "@/components/Toast";
import Lightbox from "@/components/Lightbox";
import StepTimeline, { TimelineStep } from "@/components/StepTimeline";
import { useLanguage } from "@/components/LanguageProvider";
import { maintenanceStatusLabel } from "@/lib/config";
import { fmtDate } from "@/lib/format";

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
  workerType: "IN_HOUSE" | "OUTSOURCED" | null;
  assignedWorkerId: string | null;
  workerBeforePhotos: string[];
  workerAfterPhotos: string[];
  invoiceUrl: string | null;
  cost: number | null;
  costPaidAt: string | null;
}

interface Worker {
  id: string;
  userCode: string;
  name: string;
}

const FLOW = ["SUBMITTED", "ACKNOWLEDGED", "IN_PROGRESS", "PENDING_REVIEW", "COMPLETED"];

const NEXT_ACTION: Record<string, { status: string; labelZh: string; labelEn: string; color: string } | undefined> = {
  SUBMITTED: { status: "ACKNOWLEDGED", labelZh: "受理", labelEn: "Accept", color: "bg-brand" },
  ACKNOWLEDGED: { status: "IN_PROGRESS", labelZh: "开始处理", labelEn: "Start Processing", color: "bg-amber-500" },
};

function buildSteps(r: MaintenanceRow, locale: "zh" | "en", t: (zh: string, en: string) => string): TimelineStep[] {
  if (r.status === "CANCELLED") {
    return [
      { label: maintenanceStatusLabel("SUBMITTED", locale), sublabel: fmtDate(r.createdAt), state: "done" },
      { label: t("已取消", "Cancelled"), sublabel: r.adminNote ?? undefined, state: "rejected" },
    ];
  }
  const currentIndex = FLOW.indexOf(r.status);
  return FLOW.map((s, i) => ({
    label: maintenanceStatusLabel(s, locale),
    sublabel: i === 0 ? fmtDate(r.createdAt) : undefined,
    state: i < currentIndex || (i === currentIndex && s === "COMPLETED") ? "done" : i === currentIndex ? "active" : "pending",
  }));
}

function fmt(v: number | null) {
  return v || v === 0 ? `RM${Number(v).toLocaleString()}` : "-";
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

interface AssignDraft {
  workerType: "IN_HOUSE" | "OUTSOURCED";
  assignedWorkerId: string;
  contractorName: string;
  cost: string;
  note: string;
}

export default function MaintenanceClient({ canAct }: { canAct: boolean }) {
  const toast = useToast();
  const { locale, t } = useLanguage();
  const [items, setItems] = useState<MaintenanceRow[] | null>(null);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [error, setError] = useState("");
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, AssignDraft>>({});

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/maintenance");
      const data = await res.json();
      if (!data.success) {
        setError(data.message);
        return;
      }
      setItems(
        data.requests.map((r: MaintenanceRow & { contract: { contractCode: string } }) => ({
          ...r,
          contractCode: r.contract.contractCode,
        }))
      );
    } catch {
      setError(t("出错，请稍后再试", "Something went wrong — please try again later"));
    }
  }, [t]);

  useEffect(() => {
    // setState happens after the fetch's await, not synchronously in the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    if (canAct) {
      fetch("/api/users/workers")
        .then((res) => res.json())
        .then((data) => data.success && setWorkers(data.workers));
    }
  }, [load, canAct]);

  function draftFor(r: MaintenanceRow): AssignDraft {
    return (
      draft[r.requestCode] ?? {
        workerType: r.workerType ?? "IN_HOUSE",
        assignedWorkerId: r.assignedWorkerId ?? "",
        contractorName: r.workerType === "OUTSOURCED" ? (r.assignedTo ?? "") : "",
        cost: r.cost != null ? String(r.cost) : "",
        note: r.adminNote ?? "",
      }
    );
  }
  function setDraftFor(requestCode: string, patch: Partial<AssignDraft>) {
    setDraft((m) => ({ ...m, [requestCode]: { ...draftFor(items!.find((i) => i.requestCode === requestCode)!), ...m[requestCode], ...patch } }));
  }

  async function patchRequest(requestCode: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/maintenance/${requestCode}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.success) toast.success(data.message);
    else toast.danger(data.message);
    load();
  }

  async function saveAssignment(r: MaintenanceRow) {
    const d = draftFor(r);
    if (d.workerType === "IN_HOUSE" && !d.assignedWorkerId) {
      toast.warning(t("请选一个员工", "Please select a worker"));
      return;
    }
    if (d.workerType === "OUTSOURCED" && !d.contractorName.trim()) {
      toast.warning(t("请填外包工人/公司名字", "Please enter the outsourced worker/company name"));
      return;
    }
    const workerName = workers.find((w) => w.id === d.assignedWorkerId)?.name;
    await patchRequest(r.requestCode, {
      workerType: d.workerType,
      assignedWorkerId: d.workerType === "IN_HOUSE" ? d.assignedWorkerId : "",
      assignedTo: d.workerType === "IN_HOUSE" ? (workerName ?? "") : d.contractorName.trim(),
      ...(r.status === "SUBMITTED" ? { status: "ACKNOWLEDGED" } : {}),
    });
  }

  async function uploadInvoice(r: MaintenanceRow, file: File) {
    const dataUrl = await readAsDataURL(file);
    await patchRequest(r.requestCode, { invoiceDataUrl: dataUrl });
  }

  async function saveNote(r: MaintenanceRow) {
    const d = draftFor(r);
    await patchRequest(r.requestCode, { adminNote: d.note.trim() });
  }

  async function complete(r: MaintenanceRow) {
    const d = draftFor(r);
    const cost = d.cost.trim() ? Number(d.cost) : undefined;
    await patchRequest(r.requestCode, {
      status: "COMPLETED",
      ...(cost !== undefined ? { cost, markCostPaid: true } : {}),
    });
  }

  if (!items && !error) return <div className="rounded-xl bg-white p-5 text-sm text-gray-500 shadow-sm">{t("载入中...", "Loading...")}</div>;
  if (error) return <div className="rounded-xl bg-white p-5 text-sm text-red-600 shadow-sm">{error}</div>;

  const open = items!.filter((r) => r.status !== "COMPLETED" && r.status !== "CANCELLED");
  const closed = items!.filter((r) => r.status === "COMPLETED" || r.status === "CANCELLED");

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white p-5 shadow-sm">
        <h3 className="mb-3.5 text-base font-semibold text-brand">
          {t(`🔧 报修管理 — 处理中 (${open.length})`, `🔧 Maintenance Management — In Progress (${open.length})`)}
        </h3>
        {open.length === 0 && (
          <div className="py-8 text-center text-gray-400">{t("🎉 没有待处理的报修", "🎉 No pending maintenance requests")}</div>
        )}
        <div className="space-y-3">
          {open.map((r) => {
            const next = NEXT_ACTION[r.status];
            const d = draftFor(r);
            return (
              <div key={r.requestCode} className="rounded-lg border border-gray-200 p-3.5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-[220px] flex-1">
                    <div className="text-xs text-gray-400">
                      🧾 {r.requestCode} · {t("收到日期", "Received")} {fmtDate(r.createdAt)}
                    </div>
                    <div className="text-sm font-semibold">
                      <Link href={`/contracts/${r.contractCode}`} className="text-brand hover:underline">
                        {r.contractCode}
                      </Link>{" "}
                      · {r.roomCode} · {r.tenantName}
                    </div>
                    <div className="mt-0.5 text-sm">
                      <b>{r.title}</b>
                    </div>
                    {r.description && <div className="text-xs text-gray-500">{r.description}</div>}
                    {r.photos.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-2">
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
                    <StepTimeline steps={buildSteps(r, locale, t)} />
                  </div>
                </div>

                {(r.workerBeforePhotos.length > 0 || r.workerAfterPhotos.length > 0) && (
                  <div className="mt-2 flex flex-wrap gap-4 border-t border-gray-100 pt-2">
                    {r.workerBeforePhotos.length > 0 && (
                      <div>
                        <div className="mb-1 text-xs text-gray-400">{t("工人拍的 Before", "Worker's Before Photos")}</div>
                        <div className="flex gap-1.5">
                          {r.workerBeforePhotos.map((p, i) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img key={i} src={p} alt="" onClick={() => setZoomUrl(p)} className="h-12 w-12 cursor-pointer rounded object-cover" />
                          ))}
                        </div>
                      </div>
                    )}
                    {r.workerAfterPhotos.length > 0 && (
                      <div>
                        <div className="mb-1 text-xs text-gray-400">{t("工人拍的 After", "Worker's After Photos")}</div>
                        <div className="flex gap-1.5">
                          {r.workerAfterPhotos.map((p, i) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img key={i} src={p} alt="" onClick={() => setZoomUrl(p)} className="h-12 w-12 cursor-pointer rounded object-cover" />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {canAct && (
                  <div className="mt-2.5 space-y-2 border-t border-gray-100 pt-2.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <input
                        className="input min-w-[220px] flex-1 text-xs"
                        placeholder={t("备注给租客看，例如: 配件还没到，预计延迟3天", "Note visible to tenant, e.g.: Parts haven't arrived, expect a 3-day delay")}
                        value={d.note}
                        onChange={(e) => setDraftFor(r.requestCode, { note: e.target.value })}
                      />
                      <button
                        onClick={() => saveNote(r)}
                        className="rounded-md bg-gray-100 px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-200"
                      >
                        {t("💾 保存备注", "💾 Save Note")}
                      </button>
                    </div>
                    {r.adminNote && (
                      <div className="rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
                        {t("📝 租客会看到", "📝 Tenant will see")}: {r.adminNote}
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <select
                        className="input w-[110px] text-xs"
                        value={d.workerType}
                        onChange={(e) => setDraftFor(r.requestCode, { workerType: e.target.value as "IN_HOUSE" | "OUTSOURCED" })}
                      >
                        <option value="IN_HOUSE">{t("在职员工", "In-house Staff")}</option>
                        <option value="OUTSOURCED">{t("外包", "Outsourced")}</option>
                      </select>
                      {d.workerType === "IN_HOUSE" ? (
                        <select
                          className="input w-[140px] text-xs"
                          value={d.assignedWorkerId}
                          onChange={(e) => setDraftFor(r.requestCode, { assignedWorkerId: e.target.value })}
                        >
                          <option value="">{t("选员工...", "Select worker...")}</option>
                          {workers.map((w) => (
                            <option key={w.id} value={w.id}>
                              {w.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          className="input w-[140px] text-xs"
                          placeholder={t("外包公司/工人名字", "Outsourced company/worker name")}
                          value={d.contractorName}
                          onChange={(e) => setDraftFor(r.requestCode, { contractorName: e.target.value })}
                        />
                      )}
                      <button
                        onClick={() => saveAssignment(r)}
                        className="rounded-md bg-brand px-2.5 py-1.5 text-xs font-semibold text-white"
                      >
                        {t("指派", "Assign")}
                      </button>
                      {r.assignedTo && (
                        <span className="text-xs text-gray-500">
                          {t("当前", "Current")}: {r.assignedTo}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {next && (
                        <button
                          onClick={() => patchRequest(r.requestCode, { status: next.status })}
                          className={`rounded-md ${next.color} px-3 py-1.5 text-xs font-semibold text-white`}
                        >
                          {t(next.labelZh, next.labelEn)}
                        </button>
                      )}
                      {r.status === "PENDING_REVIEW" && (
                        <span className="rounded-full bg-purple-50 px-2.5 py-1 text-xs font-semibold text-purple-700">
                          {t("⏳ 工人已提交，请检查后完成", "⏳ Worker has submitted — please review and complete")}
                        </span>
                      )}
                      {(r.status === "IN_PROGRESS" || r.status === "PENDING_REVIEW") && (
                        <>
                          <input
                            className="input w-[100px] text-xs"
                            type="number"
                            placeholder={t("费用 RM", "Cost RM")}
                            value={d.cost}
                            onChange={(e) => setDraftFor(r.requestCode, { cost: e.target.value })}
                          />
                          {d.workerType === "OUTSOURCED" && (
                            <label className="cursor-pointer rounded-md bg-gray-100 px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-200">
                              {t("📎 上传单据", "📎 Upload Invoice")}
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => e.target.files?.[0] && uploadInvoice(r, e.target.files[0])}
                              />
                            </label>
                          )}
                          {r.invoiceUrl && (
                            <button onClick={() => setZoomUrl(r.invoiceUrl)} className="text-xs font-semibold text-brand underline">
                              {t("查看单据", "View Invoice")}
                            </button>
                          )}
                          <button
                            onClick={() => complete(r)}
                            className="rounded-md bg-green-700 px-3 py-1.5 text-xs font-semibold text-white"
                          >
                            {t("✅ 标记完成", "✅ Mark Complete")}
                            {d.cost.trim() ? t(" + 出工钱", " + Pay Worker") : ""}
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => patchRequest(r.requestCode, { status: "CANCELLED" })}
                        className="rounded-md bg-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600"
                      >
                        {t("取消", "Cancel")}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {closed.length > 0 && (
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <h3 className="mb-3.5 text-base font-semibold text-gray-500">{t(`📁 已结束 (${closed.length})`, `📁 Closed (${closed.length})`)}</h3>
          <div className="space-y-2">
            {closed.map((r) => (
              <div key={r.requestCode} className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-50 py-2 text-sm last:border-none">
                <div>
                  <span className="text-gray-400">{r.requestCode} · </span>
                  <b>{r.contractCode}</b> · {r.roomCode} · {r.title}
                  {r.assignedTo && <span className="text-gray-400"> · {r.assignedTo}</span>}
                  {r.cost != null && <span className="text-gray-500"> · {fmt(r.cost)}</span>}
                  <span className="text-gray-400"> · {fmtDate(r.resolvedAt ?? r.createdAt)}</span>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    r.status === "COMPLETED" ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {maintenanceStatusLabel(r.status, locale)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {zoomUrl && <Lightbox src={zoomUrl} alt={t("报修照片", "Maintenance Photo")} onClose={() => setZoomUrl(null)} />}
    </div>
  );
}
