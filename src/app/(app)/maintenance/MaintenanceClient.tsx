"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useToast } from "@/components/Toast";
import Lightbox from "@/components/Lightbox";
import Modal from "@/components/Modal";
import ConfirmDialog from "@/components/ConfirmDialog";
import StepTimeline, { TimelineStep } from "@/components/StepTimeline";
import { useLanguage } from "@/components/LanguageProvider";
import { maintenanceStatusLabel } from "@/lib/config";
import { fmtDate, fmtMoney as fmt, isPdfUrl } from "@/lib/format";

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

interface OccupiedContract {
  contractCode: string;
  roomCode: string;
  tenantName: string;
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


// Room codes follow a "{unit}-{room number}" convention (e.g. "TLA-A0616-01" is room 01 of
// unit TLA-A0616) — grouping by that prefix lets Admin spot every room sharing a unit at a
// glance, needed when the issue is actually for a shared area (e.g. the living room) rather
// than one specific tenant's own room.
function unitCodeOf(roomCode: string): string {
  const i = roomCode.lastIndexOf("-");
  return i > 0 ? roomCode.slice(0, i) : roomCode;
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
  const [creating, setCreating] = useState(false);
  const [occupied, setOccupied] = useState<OccupiedContract[]>([]);
  const [roomSearch, setRoomSearch] = useState("");
  // "room:{contractCode}" for a specific room, or "unit:{unitCode}" for a shared-area issue
  // (e.g. the living room) — resolved to an actual contractCode only at submit time, since the
  // API still needs one room to attach the request to even when Admin picked the whole unit.
  const [createForm, setCreateForm] = useState({ selection: "", title: "", description: "" });
  const [createPhotos, setCreatePhotos] = useState<string[]>([]);
  const [createSaving, setCreateSaving] = useState(false);
  const [deleting, setDeleting] = useState<MaintenanceRow | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);
  const [editing, setEditing] = useState<MaintenanceRow | null>(null);
  const [editForm, setEditForm] = useState({ title: "", description: "", cost: "" });
  const [editSaving, setEditSaving] = useState(false);
  const [closedPeriod, setClosedPeriod] = useState<"month" | "year" | "all">("month");
  const [closedMonth, setClosedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [closedYear, setClosedYear] = useState(new Date().getFullYear());
  const [closedSearch, setClosedSearch] = useState("");

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

  async function openCreate() {
    setCreating(true);
    try {
      const res = await fetch("/api/contracts/page-data");
      const data = await res.json();
      if (!data.success) {
        toast.danger(data.message);
        return;
      }
      const list: OccupiedContract[] = data.contracts
        .filter((c: { status: string }) => c.status === "ACTIVE")
        .map((c: { contractCode: string; tenantName: string; room?: { roomCode: string } }) => ({
          contractCode: c.contractCode,
          roomCode: c.room?.roomCode ?? "",
          tenantName: c.tenantName,
        }))
        .sort((a: OccupiedContract, b: OccupiedContract) => a.roomCode.localeCompare(b.roomCode));
      setOccupied(list);
    } catch {
      toast.danger(t("网络连接失败，请检查网络后重试", "Network connection failed — please check your connection and try again"));
    }
  }

  async function addCreatePhoto(file: File) {
    if (file.size > 3 * 1024 * 1024) {
      toast.warning(t("文件太大(超过3MB)，请压缩", "File too large (over 3MB) — please compress it"));
      return;
    }
    if (createPhotos.length >= 3) {
      toast.warning(t("最多传 3 张照片", "Max 3 photos"));
      return;
    }
    const dataUrl = await readAsDataURL(file);
    setCreatePhotos((p) => [...p, dataUrl]);
  }

  async function submitCreate() {
    if (!createForm.selection) {
      toast.warning(t("请选单位或房间", "Please select a unit or room"));
      return;
    }
    if (!createForm.title.trim()) {
      toast.warning(t("请填标题, 简单说一下什么坏了", "Please enter a title — briefly describe what's broken"));
      return;
    }
    let contractCode: string | undefined;
    if (createForm.selection.startsWith("room:")) {
      contractCode = createForm.selection.slice("room:".length);
    } else {
      // Whole-unit selection — attach to that unit's first room (sorted by roomCode), since
      // the API still needs one actual contract to hang the request off.
      const unit = createForm.selection.slice("unit:".length);
      contractCode = occupied
        .filter((o) => unitCodeOf(o.roomCode) === unit)
        .sort((a, b) => a.roomCode.localeCompare(b.roomCode))[0]?.contractCode;
    }
    if (!contractCode) {
      toast.danger(t("找不到这个单位底下的房间", "Couldn't find a room under that unit"));
      return;
    }
    setCreateSaving(true);
    try {
      const res = await fetch(`/api/contracts/${contractCode}/maintenance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: createForm.title.trim(), description: createForm.description.trim(), photos: createPhotos }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setCreating(false);
        setCreateForm({ selection: "", title: "", description: "" });
        setCreatePhotos([]);
        setRoomSearch("");
        load();
      } else {
        toast.danger(data.message);
      }
    } catch {
      toast.danger(t("系统出错，请稍后再试", "System error — please try again later"));
    } finally {
      setCreateSaving(false);
    }
  }

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
    // Completing the job records what's owed (the wage/invoice amount) — it does NOT pay it
    // out. The company might settle it days later (e.g. on payday), so "出钱" is its own
    // separate action below (payWorker), which is also the only place the matching Expense
    // actually gets booked.
    await patchRequest(r.requestCode, {
      status: "COMPLETED",
      ...(cost !== undefined ? { cost } : {}),
    });
  }

  async function payWorker(r: MaintenanceRow) {
    await patchRequest(r.requestCode, { markCostPaid: true });
  }

  function openEdit(r: MaintenanceRow) {
    setEditForm({ title: r.title, description: r.description ?? "", cost: r.cost != null ? String(r.cost) : "" });
    setEditing(r);
  }

  async function saveEdit() {
    if (!editing) return;
    if (!editForm.title.trim()) {
      toast.warning(t("标题不能空白", "Title can't be empty"));
      return;
    }
    setEditSaving(true);
    try {
      const costChanged = editForm.cost !== (editing.cost != null ? String(editing.cost) : "");
      const res = await fetch(`/api/maintenance/${editing.requestCode}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editForm.title.trim(),
          description: editForm.description.trim(),
          ...(costChanged && editForm.cost.trim() ? { cost: Number(editForm.cost) } : {}),
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setEditing(null);
        load();
      } else {
        toast.danger(data.message);
      }
    } catch {
      toast.danger(t("系统出错，请稍后再试", "System error — please try again later"));
    } finally {
      setEditSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteSaving(true);
    try {
      const res = await fetch(`/api/maintenance/${deleting.requestCode}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) toast.success(data.message);
      else toast.danger(data.message);
      setDeleting(null);
      load();
    } catch {
      toast.danger(t("网络连接失败，请检查网络后重试", "Network connection failed — please check your connection and try again"));
    } finally {
      setDeleteSaving(false);
    }
  }

  if (!items && !error) return <div className="rounded-xl bg-white p-5 text-sm text-gray-500 shadow-sm">{t("载入中...", "Loading...")}</div>;
  if (error) return <div className="rounded-xl bg-white p-5 text-sm text-red-600 shadow-sm">{error}</div>;

  const open = items!.filter((r) => r.status !== "COMPLETED" && r.status !== "CANCELLED");
  const closed = items!.filter((r) => r.status === "COMPLETED" || r.status === "CANCELLED");

  const closedQ = closedSearch.trim().toLowerCase();
  const filteredClosed = closed.filter((r) => {
    const ymd = (r.resolvedAt ?? r.createdAt).slice(0, 10);
    if (closedPeriod === "month" && ymd.slice(0, 7) !== closedMonth) return false;
    if (closedPeriod === "year" && ymd.slice(0, 4) !== String(closedYear)) return false;
    if (!closedQ) return true;
    return (
      r.requestCode.toLowerCase().includes(closedQ) ||
      r.contractCode.toLowerCase().includes(closedQ) ||
      r.roomCode.toLowerCase().includes(closedQ) ||
      r.title.toLowerCase().includes(closedQ) ||
      (r.assignedTo ?? "").toLowerCase().includes(closedQ) ||
      (r.tenantName ?? "").toLowerCase().includes(closedQ)
    );
  });
  const closedYears = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i);

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white p-5 shadow-sm">
        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2.5">
          <h3 className="text-base font-semibold text-brand">
            {t(`🔧 报修管理 — 处理中 (${open.length})`, `🔧 Maintenance Management — In Progress (${open.length})`)}
          </h3>
          {canAct && (
            <button onClick={openCreate} className="btn-primary text-sm">
              ➕ {t("开报修", "New Request")}
            </button>
          )}
        </div>
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
                        {r.photos.map((p, i) =>
                          isPdfUrl(p) ? (
                            <a
                              key={i}
                              href={p}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex h-14 w-14 flex-col items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-[10px] font-semibold text-brand hover:bg-gray-100"
                            >
                              📄 PDF
                            </a>
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              key={i}
                              src={p}
                              alt=""
                              onClick={() => setZoomUrl(p)}
                              className="h-14 w-14 cursor-pointer rounded-lg border border-gray-200 object-cover hover:opacity-90"
                            />
                          )
                        )}
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
                          {r.workerBeforePhotos.map((p, i) =>
                            isPdfUrl(p) ? (
                              <a
                                key={i}
                                href={p}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex h-12 w-12 flex-col items-center justify-center rounded border border-gray-200 bg-gray-50 text-[10px] font-semibold text-brand hover:bg-gray-100"
                              >
                                📄 PDF
                              </a>
                            ) : (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img key={i} src={p} alt="" onClick={() => setZoomUrl(p)} className="h-12 w-12 cursor-pointer rounded object-cover" />
                            )
                          )}
                        </div>
                      </div>
                    )}
                    {r.workerAfterPhotos.length > 0 && (
                      <div>
                        <div className="mb-1 text-xs text-gray-400">{t("工人拍的 After", "Worker's After Photos")}</div>
                        <div className="flex gap-1.5">
                          {r.workerAfterPhotos.map((p, i) =>
                            isPdfUrl(p) ? (
                              <a
                                key={i}
                                href={p}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex h-12 w-12 flex-col items-center justify-center rounded border border-gray-200 bg-gray-50 text-[10px] font-semibold text-brand hover:bg-gray-100"
                              >
                                📄 PDF
                              </a>
                            ) : (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img key={i} src={p} alt="" onClick={() => setZoomUrl(p)} className="h-12 w-12 cursor-pointer rounded object-cover" />
                            )
                          )}
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
                                accept="image/*,application/pdf"
                                className="hidden"
                                onChange={(e) => e.target.files?.[0] && uploadInvoice(r, e.target.files[0])}
                              />
                            </label>
                          )}
                          {r.invoiceUrl && (
                            isPdfUrl(r.invoiceUrl) ? (
                              <a href={r.invoiceUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-brand underline">
                                {t("📄 查看单据 (PDF)", "📄 View Invoice (PDF)")}
                              </a>
                            ) : (
                              <button onClick={() => setZoomUrl(r.invoiceUrl)} className="text-xs font-semibold text-brand underline">
                                {t("查看单据", "View Invoice")}
                              </button>
                            )
                          )}
                          <button
                            onClick={() => complete(r)}
                            className="rounded-md bg-green-700 px-3 py-1.5 text-xs font-semibold text-white"
                          >
                            {t("✅ 标记完成", "✅ Mark Complete")}
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => patchRequest(r.requestCode, { status: "CANCELLED" })}
                        className="rounded-md bg-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600"
                      >
                        {t("取消", "Cancel")}
                      </button>
                      <button
                        onClick={() => openEdit(r)}
                        className="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-600"
                      >
                        ✏️ {t("编辑", "Edit")}
                      </button>
                      <button
                        onClick={() => setDeleting(r)}
                        className="rounded-md bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
                      >
                        🗑️ {t("删除", "Delete")}
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
          <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2.5">
            <h3 className="text-base font-semibold text-gray-500">📁 {t("已结束", "Closed")}</h3>
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex gap-1.5">
                {(["month", "year", "all"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setClosedPeriod(p)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      closedPeriod === p ? "bg-brand text-white" : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {p === "month" ? t("本月", "This Month") : p === "year" ? t("本年", "This Year") : t("全部", "All Time")}
                  </button>
                ))}
              </div>
              {closedPeriod === "month" && (
                <input
                  type="month"
                  value={closedMonth}
                  onChange={(e) => setClosedMonth(e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                />
              )}
              {closedPeriod === "year" && (
                <select
                  value={closedYear}
                  onChange={(e) => setClosedYear(Number(e.target.value))}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                >
                  {closedYears.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              )}
              <input
                value={closedSearch}
                onChange={(e) => setClosedSearch(e.target.value)}
                placeholder={t("🔍 搜合同/房间/标题/员工...", "🔍 Search contract/room/title/worker...")}
                className="input w-[220px] text-sm"
              />
            </div>
          </div>
          <div className="mb-2 text-xs text-gray-500">
            {filteredClosed.length === closed.length
              ? t(`共 ${closed.length} 笔`, `${closed.length} total`)
              : t(`共 ${filteredClosed.length} 笔 (全部 ${closed.length} 笔中)`, `${filteredClosed.length} shown (of ${closed.length} total)`)}
          </div>
          {filteredClosed.length === 0 && (
            <div className="py-6 text-center text-sm text-gray-400">{t("没有符合条件的记录", "No records match your filters")}</div>
          )}
          <div className="space-y-2">
            {filteredClosed.map((r) => {
              const costUnpaid = r.cost != null && !r.costPaidAt;
              return (
                <div key={r.requestCode} className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-50 py-2 text-sm last:border-none">
                  <div>
                    <span className="text-gray-400">{r.requestCode} · </span>
                    <b>{r.contractCode}</b> · {r.roomCode} · {r.title}
                    {r.assignedTo && <span className="text-gray-400"> · {r.assignedTo}</span>}
                    {r.cost != null && (
                      <span className={costUnpaid ? "font-semibold text-amber-600" : "text-gray-500"}>
                        {" "}
                        · {fmt(r.cost)} ({costUnpaid ? t("待出钱", "Unpaid") : t("已出钱", "Paid")})
                      </span>
                    )}
                    <span className="text-gray-400"> · {fmtDate(r.resolvedAt ?? r.createdAt)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {canAct && costUnpaid && (
                      <button
                        onClick={() => payWorker(r)}
                        className="rounded-md bg-amber-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-600"
                      >
                        💰 {t("出工钱", "Pay Worker")}
                      </button>
                    )}
                    {canAct && (
                      <button
                        onClick={() => openEdit(r)}
                        className="rounded-md bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-200"
                      >
                        ✏️ {t("编辑", "Edit")}
                      </button>
                    )}
                    {canAct && (
                      <button
                        onClick={() => setDeleting(r)}
                        className="rounded-md bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
                      >
                        🗑️ {t("删除", "Delete")}
                      </button>
                    )}
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        r.status === "COMPLETED" ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {maintenanceStatusLabel(r.status, locale)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {zoomUrl && <Lightbox src={zoomUrl} alt={t("报修照片", "Maintenance Photo")} onClose={() => setZoomUrl(null)} />}

      {creating && (
        <Modal onClose={() => setCreating(false)}>
          <h3 className="mb-3.5 text-lg font-bold text-brand">🔧 {t("开报修", "New Maintenance Request")}</h3>
          <div className="space-y-3">
            {(() => {
              const q = roomSearch.trim().toLowerCase();
              const filtered = q
                ? occupied.filter(
                    (o) =>
                      o.roomCode.toLowerCase().includes(q) ||
                      o.tenantName.toLowerCase().includes(q) ||
                      unitCodeOf(o.roomCode).toLowerCase().includes(q)
                  )
                : occupied;
              const groups = new Map<string, OccupiedContract[]>();
              for (const o of filtered) {
                const unit = unitCodeOf(o.roomCode);
                if (!groups.has(unit)) groups.set(unit, []);
                groups.get(unit)!.push(o);
              }
              return (
                <div>
                  <label className="mb-1.5 block text-sm text-gray-600">{t("选单位或房间", "Select Unit or Room")}</label>
                  <p className="mb-1.5 text-xs text-gray-400">
                    {t(
                      "修客厅等共用区域就直接选单位；修某间房自己的问题就选那间房",
                      "Pick the unit directly for a shared area like the living room; pick a specific room for an issue in that room itself"
                    )}
                  </p>
                  <input
                    className="input mb-1.5"
                    placeholder={t("🔍 搜单位/房间/租客...", "🔍 Search unit/room/tenant...")}
                    value={roomSearch}
                    onChange={(e) => setRoomSearch(e.target.value)}
                  />
                  <div className="max-h-[280px] overflow-auto rounded-lg border border-gray-200">
                    {occupied.length === 0 && (
                      <div className="p-3 text-center text-xs text-gray-400">{t("载入中...", "Loading...")}</div>
                    )}
                    {occupied.length > 0 && filtered.length === 0 && (
                      <div className="p-3 text-center text-xs text-gray-400">{t("没有符合的房间", "No matching rooms")}</div>
                    )}
                    {[...groups.entries()].map(([unit, rooms]) => (
                      <div key={unit}>
                        <div className="bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                          🏠 {unit} ({rooms.length})
                        </div>
                        <label className="flex cursor-pointer items-center gap-2 border-b border-gray-100 bg-amber-50/50 px-3 py-2 text-sm hover:bg-amber-50">
                          <input
                            type="radio"
                            name="maintenance-room"
                            checked={createForm.selection === `unit:${unit}`}
                            onChange={() => setCreateForm({ ...createForm, selection: `unit:${unit}` })}
                          />
                          <span className="font-semibold text-amber-700">{t(`${unit} — 整个单位/公共区域`, `${unit} — Whole Unit / Common Area`)}</span>
                        </label>
                        {rooms.map((o) => (
                          <label
                            key={o.contractCode}
                            className="flex cursor-pointer items-center gap-2 border-b border-gray-100 px-3 py-2 text-sm last:border-b-0 hover:bg-gray-50"
                          >
                            <input
                              type="radio"
                              name="maintenance-room"
                              checked={createForm.selection === `room:${o.contractCode}`}
                              onChange={() => setCreateForm({ ...createForm, selection: `room:${o.contractCode}` })}
                            />
                            <span className="font-semibold">{o.roomCode}</span>
                            <span className="text-gray-500">— {o.tenantName}</span>
                          </label>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
            <div>
              <label className="mb-1.5 block text-sm text-gray-600">{t("标题", "Title")}</label>
              <input
                className="input"
                placeholder={t("标题，例如: 冷气不制冷", "Title, e.g.: Air-cond not cooling")}
                value={createForm.title}
                onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-gray-600">{t("详细说明 (可选)", "Details (optional)")}</label>
              <textarea
                className="input"
                rows={2}
                value={createForm.description}
                onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-gray-600">{t("照片 (可选，最多3张)", "Photos (optional, up to 3)")}</label>
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => e.target.files?.[0] && addCreatePhoto(e.target.files[0])}
                className="block w-full text-xs text-gray-500 file:mr-2 file:cursor-pointer file:rounded-lg file:border-0 file:bg-brand file:px-2.5 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-brand-dark"
              />
              {createPhotos.length > 0 && (
                <div className="mt-2 flex gap-2">
                  {createPhotos.map((p, i) =>
                    isPdfUrl(p) ? (
                      <div
                        key={i}
                        className="flex h-14 w-14 flex-col items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-[10px] font-semibold text-brand"
                      >
                        📄 PDF
                      </div>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={i} src={p} alt="" className="h-14 w-14 rounded-lg object-cover" />
                    )
                  )}
                </div>
              )}
            </div>
            <button onClick={submitCreate} disabled={createSaving} className="btn-primary w-full">
              {createSaving ? t("提交中...", "Submitting...") : t("提交报修", "Submit Request")}
            </button>
          </div>
        </Modal>
      )}

      {editing && (
        <Modal onClose={() => setEditing(null)}>
          <h3 className="mb-3.5 text-lg font-bold text-brand">✏️ {t("编辑报修单", "Edit Maintenance Request")}</h3>
          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-sm text-gray-600">{t("标题", "Title")}</label>
              <input
                className="input"
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-gray-600">{t("详细说明", "Details")}</label>
              <textarea
                className="input"
                rows={2}
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-gray-600">{t("费用 RM", "Cost RM")}</label>
              <input
                type="number"
                className="input"
                disabled={!!editing.costPaidAt}
                value={editForm.cost}
                onChange={(e) => setEditForm({ ...editForm, cost: e.target.value })}
              />
              {editing.costPaidAt && (
                <p className="mt-1 text-xs text-gray-400">
                  {t("已经出过钱了，费用不能再改 (已经登记了对应的支出)", "Already paid out — cost can't be changed (a matching Expense is already booked)")}
                </p>
              )}
            </div>
            <button onClick={saveEdit} disabled={editSaving} className="btn-primary w-full">
              {editSaving ? t("保存中...", "Saving...") : t("保存", "Save")}
            </button>
          </div>
        </Modal>
      )}

      <ConfirmDialog
        open={!!deleting}
        danger
        title={t("删除报修单", "Delete Maintenance Request")}
        message={t(
          `确定要删除报修单 ${deleting?.requestCode} (${deleting?.title}) 吗？此操作不能撤销。${
            deleting?.cost != null && deleting?.costPaidAt ? "这张已经出过钱了，已登记的支出不会被删除。" : ""
          }`,
          `Delete maintenance request ${deleting?.requestCode} (${deleting?.title})? This can't be undone.${
            deleting?.cost != null && deleting?.costPaidAt ? " This one was already paid out — the Expense it booked won't be removed." : ""
          }`
        )}
        confirmLabel={deleteSaving ? t("删除中...", "Deleting...") : t("确定删除", "Confirm Delete")}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
