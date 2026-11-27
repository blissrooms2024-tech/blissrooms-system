"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Modal from "@/components/Modal";
import ConfirmDialog from "@/components/ConfirmDialog";
import Lightbox from "@/components/Lightbox";
import { useToast } from "@/components/Toast";
import { useLanguage } from "@/components/LanguageProvider";
import { fmtDate, fmtMoney } from "@/lib/format";
import { expenseCategoryLabelLocale, MANUAL_EXPENSE_CATEGORIES, type ManualExpenseCategory } from "@/lib/config";
import { readAsDataURL, isOversized } from "@/lib/imageUpload";

type ClaimStatus = "PENDING" | "APPROVED" | "REJECTED" | "PAID";

interface Claim {
  claimCode: string;
  status: ClaimStatus;
  isMine: boolean;
  submittedByName: string;
  propertyCode: string | null;
  propertyName: string | null;
  roomCode: string | null;
  category: string;
  customLabel: string | null;
  amount: number;
  expenseDate: string;
  periodMonth: string;
  notes: string | null;
  receipts: string[];
  reviewedByName: string | null;
  reviewedAt: string | null;
  rejectReason: string | null;
  expenseCode: string | null;
  paidAt: string | null;
  paidRef: string | null;
  paidSlip: string | null;
  paidByName: string | null;
  createdAt: string;
}

interface PropertyOption {
  propertyCode: string;
  name: string;
  rooms: { roomCode: string }[];
}

type Tab = "review" | "topay" | "all" | "mine";

const COMPANY = "__COMPANY__";
const MAX_RECEIPTS = 6;
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function isPdfUrl(url: string) {
  try {
    return /\.pdf($|[^a-z])/i.test(decodeURIComponent(url));
  } catch {
    return /\.pdf/i.test(url);
  }
}

async function uploadFile(file: File): Promise<string> {
  const dataUrl = await readAsDataURL(file);
  const res = await fetch("/api/claims/receipt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dataUrl }),
  });
  const data = await res.json().catch(() => ({ success: false, message: "上传失败" }));
  if (!data.success) throw new Error(data.message || "上传失败");
  return data.url as string;
}

function StatusBadge({ status }: { status: ClaimStatus }) {
  const { t } = useLanguage();
  const map: Record<ClaimStatus, { label: string; cls: string }> = {
    PENDING: { label: t("待审批", "Pending"), cls: "bg-yellow-100 text-yellow-800" },
    APPROVED: { label: t("已批准·待付款", "Approved · to pay"), cls: "bg-blue-100 text-blue-800" },
    REJECTED: { label: t("已拒绝", "Rejected"), cls: "bg-red-100 text-red-700" },
    PAID: { label: t("已付款", "Paid"), cls: "bg-green-100 text-green-800" },
  };
  const m = map[status];
  return <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${m.cls}`}>{m.label}</span>;
}

function FileThumb({ url, onView }: { url: string; onView: (u: string) => void }) {
  if (isPdfUrl(url)) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="flex h-16 w-16 flex-col items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-xs text-gray-600"
      >
        <span className="text-2xl">📄</span>PDF
      </a>
    );
  }
  return (
    <button type="button" onClick={() => onView(url)} className="h-16 w-16 overflow-hidden rounded-lg border border-gray-200">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" className="h-full w-full object-cover" />
    </button>
  );
}

export default function ClaimsClient({ role, openNew = false }: { role: string; openNew?: boolean }) {
  const { t, locale } = useLanguage();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [canSubmit, setCanSubmit] = useState(false);
  const [canReview, setCanReview] = useState(false);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [mine, setMine] = useState<Claim[]>([]);
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [summary, setSummary] = useState<Record<string, { count: number; amount: number }>>({});
  const [tab, setTab] = useState<Tab>(role === "WORKER" ? "mine" : "review");
  const [search, setSearch] = useState("");
  const [viewing, setViewing] = useState<string | null>(null);

  // submit form
  const emptyForm = {
    propertyCode: "",
    roomCode: "",
    category: "MAINTENANCE" as ManualExpenseCategory,
    customLabel: "",
    amount: "",
    expenseDate: todayStr(),
    notes: "",
  };
  // /claims?new=1 (the home page's "+" → 提交报销) opens the form straight away.
  const [showForm, setShowForm] = useState(openNew && (role === "ADMIN" || role === "WORKER"));
  useEffect(() => {
    // Drop ?new=1 so a refresh or Back doesn't pop the form open again.
    if (openNew) window.history.replaceState(null, "", "/claims");
  }, [openNew]);
  const [form, setForm] = useState(emptyForm);
  const [receipts, setReceipts] = useState<string[]>([]);
  const [uploading, setUploading] = useState(0);
  const [saving, setSaving] = useState(false);

  // review actions
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<Claim | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [paying, setPaying] = useState<Claim | null>(null);
  const [payForm, setPayForm] = useState({ paidAt: todayStr(), paidRef: "", paidSlip: "" });
  const [slipUploading, setSlipUploading] = useState(false);
  const [confirm, setConfirm] = useState<{ claim: Claim; kind: "approve" | "unapprove" | "delete" } | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const reviewer = role === "BOSS" || role === "ADMIN";
      const [allRes, mineRes] = await Promise.all([
        reviewer ? fetch("/api/claims?scope=all").then((r) => r.json()) : Promise.resolve(null),
        fetch("/api/claims?scope=mine").then((r) => r.json()),
      ]);
      if (!mineRes.success) throw new Error(mineRes.message);
      if (allRes && !allRes.success) throw new Error(allRes.message);
      setCanSubmit(mineRes.canSubmit);
      setCanReview(mineRes.canReview);
      setMine(mineRes.claims);
      setProperties(mineRes.properties);
      if (allRes) {
        setClaims(allRes.claims);
        setSummary(allRes.summary);
      }
    } catch (e) {
      setError((e as Error).message || t("加载失败", "Failed to load"));
    } finally {
      setLoading(false);
    }
  }, [role, t]);

  useEffect(() => {
    // setState happens after the fetch's await, not synchronously in the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const roomsForProperty = useMemo(
    () => properties.find((p) => p.propertyCode === form.propertyCode)?.rooms ?? [],
    [properties, form.propertyCode]
  );

  const tabClaims = useMemo(() => {
    let list: Claim[];
    if (tab === "mine") list = mine;
    else if (tab === "review") list = claims.filter((c) => c.status === "PENDING");
    else if (tab === "topay") list = claims.filter((c) => c.status === "APPROVED");
    else list = claims;
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((c) =>
      [c.claimCode, c.submittedByName, c.propertyCode, c.propertyName, c.roomCode, c.notes, c.customLabel]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [tab, mine, claims, search]);

  function categoryLabel(c: { category: string; customLabel: string | null }) {
    return expenseCategoryLabelLocale(c.category, c.customLabel, locale);
  }

  async function addReceipts(files: FileList | null) {
    if (!files || files.length === 0) return;
    const list = Array.from(files).slice(0, MAX_RECEIPTS - receipts.length);
    if (list.length < files.length) toast.warning(t(`最多 ${MAX_RECEIPTS} 个文件`, `Max ${MAX_RECEIPTS} files`));
    for (const file of list) {
      if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
        toast.warning(t(`${file.name} 不是照片或 PDF，已跳过`, `${file.name} is not a photo or PDF — skipped`));
        continue;
      }
      if (isOversized(file)) {
        toast.warning(t(`${file.name} 超过 3MB，请压缩 PDF`, `${file.name} is over 3MB — please compress the PDF`));
        continue;
      }
      setUploading((n) => n + 1);
      try {
        const url = await uploadFile(file);
        setReceipts((r) => [...r, url]);
      } catch (e) {
        toast.danger((e as Error).message);
      } finally {
        setUploading((n) => n - 1);
      }
    }
  }

  async function submitClaim() {
    if (!form.propertyCode) return toast.warning(t("请选择单位（或公司开销）", "Please choose a unit (or company overhead)"));
    if (!form.amount || Number(form.amount) <= 0) return toast.warning(t("请填金额", "Please enter the amount"));
    if (form.category === "OTHER" && !form.customLabel.trim())
      return toast.warning(t("「其他」类型要填支出名称", "Please name the expense for \"Other\""));
    if (receipts.length === 0) return toast.warning(t("请至少上传一张单据照片", "Please upload at least one receipt"));
    if (uploading > 0) return toast.warning(t("单据还在上传，请稍等", "Receipts are still uploading"));

    setSaving(true);
    try {
      const res = await fetch("/api/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          propertyCode: form.propertyCode === COMPANY ? "" : form.propertyCode,
          roomCode: form.propertyCode === COMPANY ? "" : form.roomCode,
          receipts,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setShowForm(false);
        setForm(emptyForm);
        setReceipts([]);
        setTab("mine");
        load();
      } else toast.danger(data.message);
    } finally {
      setSaving(false);
    }
  }

  async function act(claim: Claim, body: Record<string, string>) {
    setBusy(claim.claimCode);
    try {
      const res = await fetch(`/api/claims/${claim.claimCode}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        load();
        return true;
      }
      toast.danger(data.message);
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function removeClaim(claim: Claim) {
    setBusy(claim.claimCode);
    try {
      const res = await fetch(`/api/claims/${claim.claimCode}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        load();
      } else toast.danger(data.message);
    } finally {
      setBusy(null);
    }
  }

  async function uploadSlip(file: File | undefined) {
    if (!file) return;
    if (isOversized(file)) return toast.warning(t("文件超过 3MB", "File is over 3MB"));
    setSlipUploading(true);
    try {
      const url = await uploadFile(file);
      setPayForm((f) => ({ ...f, paidSlip: url }));
    } catch (e) {
      toast.danger((e as Error).message);
    } finally {
      setSlipUploading(false);
    }
  }

  const reviewerTabs: { key: Tab; label: string; count?: number }[] = canReview
    ? [
        { key: "review", label: t("待审批", "To review"), count: claims.filter((c) => c.status === "PENDING").length },
        { key: "topay", label: t("待付款", "To pay"), count: claims.filter((c) => c.status === "APPROVED").length },
        { key: "all", label: t("全部", "All") },
      ]
    : [];
  const tabs = [...reviewerTabs, ...(canSubmit ? [{ key: "mine" as Tab, label: t("我的报销", "My claims"), count: undefined }] : [])];

  if (loading) return <div className="rounded-xl bg-white p-5 text-sm text-gray-400 shadow-sm">{t("加载中…", "Loading…")}</div>;

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2.5">
          <h3 className="text-base font-semibold text-brand">💸 {t("报销", "Expense Claims")}</h3>
          {canSubmit && (
            <button onClick={() => setShowForm(true)} className="btn-primary w-full py-2.5 sm:w-auto">
              ➕ {t("提交报销", "New claim")}
            </button>
          )}
        </div>

        {canReview && (
          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(
              [
                ["PENDING", t("待审批", "Pending"), "text-yellow-700"],
                ["APPROVED", t("待付款", "To pay"), "text-blue-700"],
                ["PAID", t("已付款", "Paid"), "text-green-700"],
                ["REJECTED", t("已拒绝", "Rejected"), "text-red-600"],
              ] as const
            ).map(([k, label, cls]) => (
              <div key={k} className="rounded-lg bg-gray-50 p-2.5">
                <div className="text-xs text-gray-500">
                  {label} · {summary[k]?.count ?? 0}
                </div>
                <div className={`text-sm font-bold ${cls}`}>{fmtMoney(summary[k]?.amount ?? 0)}</div>
              </div>
            ))}
          </div>
        )}

        {tabs.length > 1 && (
          <div className="-mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-1">
            {tabs.map((tb) => (
              <button
                key={tb.key}
                onClick={() => setTab(tb.key)}
                className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-semibold ${
                  tab === tb.key ? "bg-brand text-white" : "bg-brand-light text-brand"
                }`}
              >
                {tb.label}
                {tb.count ? ` (${tb.count})` : ""}
              </button>
            ))}
          </div>
        )}

        <input
          className="input mb-1"
          placeholder={t("搜索：编号 / 名字 / 单位 / 房间", "Search: code / name / unit / room")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {error && <div className="mt-2 text-sm text-red-600">{error}</div>}
      </div>

      {tabClaims.length === 0 ? (
        <div className="rounded-xl bg-white p-8 text-center text-sm text-gray-400 shadow-sm">
          {t("没有报销记录", "No claims here")}
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {tabClaims.map((c) => {
            const reviewerCanAct = canReview && !c.isMine;
            return (
              <div key={c.claimCode} className="rounded-xl bg-white p-4 shadow-sm">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs text-gray-400">
                      {c.claimCode} · {fmtDate(c.createdAt)}
                    </div>
                    <div className="text-lg font-bold">{fmtMoney(c.amount)}</div>
                  </div>
                  <StatusBadge status={c.status} />
                </div>

                <div className="space-y-1 text-sm">
                  <div>
                    <span className="text-gray-500">{t("单位", "Unit")}: </span>
                    <b>
                      {c.propertyCode
                        ? `${c.propertyCode}${c.roomCode ? ` / ${c.roomCode}` : ""}`
                        : t("🏢 公司开销", "🏢 Company overhead")}
                    </b>
                    {c.propertyName && <span className="text-gray-500"> · {c.propertyName}</span>}
                  </div>
                  <div>
                    <span className="text-gray-500">{t("类别", "Category")}: </span>
                    {categoryLabel(c)} · <span className="text-gray-500">{t("消费日期", "Spent on")}</span> {fmtDate(c.expenseDate)}
                  </div>
                  {!c.isMine && (
                    <div>
                      <span className="text-gray-500">{t("提交人", "Submitted by")}: </span>
                      {c.submittedByName}
                    </div>
                  )}
                  {c.notes && <div className="whitespace-pre-wrap text-gray-700">📝 {c.notes}</div>}
                </div>

                {c.receipts.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {c.receipts.map((u) => (
                      <FileThumb key={u} url={u} onView={setViewing} />
                    ))}
                  </div>
                )}

                {(c.reviewedByName || c.paidAt) && (
                  <div className="mt-2.5 space-y-0.5 rounded-lg bg-gray-50 p-2.5 text-xs text-gray-600">
                    {c.reviewedByName && c.status !== "REJECTED" && (
                      <div>
                        ✅ {t("批准", "Approved by")}: {c.reviewedByName} · {fmtDate(c.reviewedAt)}
                        {c.expenseCode && ` · ${t("支出", "Expense")} ${c.expenseCode}`}
                      </div>
                    )}
                    {c.status === "REJECTED" && (
                      <div className="text-red-600">
                        ❌ {t("拒绝", "Rejected by")}: {c.reviewedByName} · {fmtDate(c.reviewedAt)} — {c.rejectReason}
                      </div>
                    )}
                    {c.paidAt && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        💰 {t("已转账", "Paid")} {fmtDate(c.paidAt)} · {c.paidByName}
                        {c.paidRef && ` · Ref ${c.paidRef}`}
                        {c.paidSlip && (
                          <button
                            onClick={() => (isPdfUrl(c.paidSlip!) ? window.open(c.paidSlip!, "_blank") : setViewing(c.paidSlip!))}
                            className="text-brand underline"
                          >
                            {t("转账单", "Slip")}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  {reviewerCanAct && c.status === "PENDING" && (
                    <>
                      <button
                        disabled={busy === c.claimCode}
                        onClick={() => setConfirm({ claim: c, kind: "approve" })}
                        className="btn-primary flex-1 py-2.5"
                      >
                        ✅ {t("批准", "Approve")}
                      </button>
                      <button
                        disabled={busy === c.claimCode}
                        onClick={() => {
                          setRejecting(c);
                          setRejectReason("");
                        }}
                        className="flex-1 rounded-lg bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-100"
                      >
                        ❌ {t("拒绝", "Reject")}
                      </button>
                    </>
                  )}
                  {reviewerCanAct && c.status === "APPROVED" && (
                    <button
                      disabled={busy === c.claimCode}
                      onClick={() => {
                        setPaying(c);
                        setPayForm({ paidAt: todayStr(), paidRef: "", paidSlip: "" });
                      }}
                      className="btn-primary flex-1 py-2.5"
                    >
                      💰 {t("记录已转账", "Record payment")}
                    </button>
                  )}
                  {role === "BOSS" && !c.isMine && c.status === "APPROVED" && (
                    <button
                      disabled={busy === c.claimCode}
                      onClick={() => setConfirm({ claim: c, kind: "unapprove" })}
                      className="btn-soft py-2.5"
                    >
                      ↩️ {t("撤销批准", "Undo approval")}
                    </button>
                  )}
                  {(c.isMine || role === "BOSS") && (c.status === "PENDING" || c.status === "REJECTED") && (
                    <button
                      disabled={busy === c.claimCode}
                      onClick={() => setConfirm({ claim: c, kind: "delete" })}
                      className="rounded-lg px-3 py-2.5 text-sm text-gray-500 hover:bg-gray-100"
                    >
                      🗑️ {t("删除", "Delete")}
                    </button>
                  )}
                  {canReview && c.isMine && (c.status === "PENDING" || c.status === "APPROVED") && (
                    <div className="w-full text-xs text-gray-400">
                      {t("自己的报销要由 Boss 或另一位 Admin 处理", "Your own claim must be handled by Boss or another Admin")}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <Modal onClose={() => !saving && setShowForm(false)}>
          <h3 className="mb-3 text-base font-semibold text-brand">➕ {t("提交报销", "New expense claim")}</h3>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm text-gray-600">{t("单位", "Unit")} *</label>
              <select
                className="input"
                value={form.propertyCode}
                onChange={(e) => setForm({ ...form, propertyCode: e.target.value, roomCode: "" })}
              >
                <option value="">{t("— 请选择 —", "— Choose —")}</option>
                <option value={COMPANY}>{t("🏢 公司开销（不属于任何单位）", "🏢 Company overhead (no unit)")}</option>
                {properties.map((p) => (
                  <option key={p.propertyCode} value={p.propertyCode}>
                    {p.propertyCode} · {p.name}
                  </option>
                ))}
              </select>
            </div>
            {form.propertyCode && form.propertyCode !== COMPANY && (
              <div>
                <label className="mb-1 block text-sm text-gray-600">{t("房间（可不选）", "Room (optional)")}</label>
                <select className="input" value={form.roomCode} onChange={(e) => setForm({ ...form, roomCode: e.target.value })}>
                  <option value="">{t("— 整个单位 —", "— Whole unit —")}</option>
                  {roomsForProperty.map((r) => (
                    <option key={r.roomCode} value={r.roomCode}>
                      {r.roomCode}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="mb-1 block text-sm text-gray-600">{t("类别", "Category")} *</label>
              <select
                className="input"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as ManualExpenseCategory })}
              >
                {MANUAL_EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {expenseCategoryLabelLocale(c, undefined, locale)}
                  </option>
                ))}
              </select>
            </div>
            {form.category === "OTHER" && (
              <div>
                <label className="mb-1 block text-sm text-gray-600">{t("支出名称", "Expense name")} *</label>
                <input
                  className="input"
                  value={form.customLabel}
                  maxLength={60}
                  placeholder={t("例：灭虫费", "e.g. Pest control")}
                  onChange={(e) => setForm({ ...form, customLabel: e.target.value })}
                />
              </div>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-gray-600">{t("金额 (RM)", "Amount (RM)")} *</label>
                <input
                  className="input"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-600">{t("消费日期", "Date spent")} *</label>
                <input
                  className="input"
                  type="date"
                  max={todayStr()}
                  value={form.expenseDate}
                  onChange={(e) => setForm({ ...form, expenseDate: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm text-gray-600">{t("备注", "Notes")}</label>
              <textarea
                className="input"
                rows={2}
                maxLength={500}
                placeholder={t("买了什么、为什么", "What was bought and why")}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-gray-600">
                {t("单据（拍照 / 相册 / PDF）", "Receipts (camera / gallery / PDF)")} *
              </label>
              <div className="flex flex-wrap gap-2">
                {receipts.map((u) => (
                  <div key={u} className="relative">
                    <FileThumb url={u} onView={setViewing} />
                    <button
                      type="button"
                      onClick={() => setReceipts((r) => r.filter((x) => x !== u))}
                      className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-gray-800 text-xs text-white"
                      aria-label={t("移除", "Remove")}
                    >
                      ×
                    </button>
                  </div>
                ))}
                {uploading > 0 && (
                  <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-gray-300 text-xs text-gray-400">
                    {t("上传中…", "Uploading…")}
                  </div>
                )}
                {receipts.length + uploading < MAX_RECEIPTS && (
                  <label className="flex h-16 w-16 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-brand/40 text-xs text-brand">
                    <span className="text-xl">📷</span>
                    {t("添加", "Add")}
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        addReceipts(e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </label>
                )}
              </div>
              <p className="mt-1 text-xs text-gray-400">
                {t("照片会自动压缩，不用自己处理。", "Photos are compressed automatically.")}
              </p>
            </div>
            <button onClick={submitClaim} disabled={saving || uploading > 0} className="btn-primary w-full py-2.5">
              {saving ? t("提交中…", "Submitting…") : t("提交报销", "Submit claim")}
            </button>
          </div>
        </Modal>
      )}

      {rejecting && (
        <Modal onClose={() => setRejecting(null)}>
          <h3 className="mb-2 text-base font-semibold text-red-600">
            ❌ {t("拒绝报销", "Reject claim")} {rejecting.claimCode}
          </h3>
          <p className="mb-2 text-sm text-gray-600">
            {rejecting.submittedByName} · {fmtMoney(rejecting.amount)}
          </p>
          <label className="mb-1 block text-sm text-gray-600">{t("原因（提交人会看到）", "Reason (shown to submitter)")} *</label>
          <textarea className="input" rows={3} maxLength={300} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
          <button
            className="mt-3 w-full rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:bg-red-300"
            disabled={!rejectReason.trim() || busy === rejecting.claimCode}
            onClick={async () => {
              if (await act(rejecting, { action: "reject", reason: rejectReason.trim() })) setRejecting(null);
            }}
          >
            {t("确认拒绝", "Confirm reject")}
          </button>
        </Modal>
      )}

      {paying && (
        <Modal onClose={() => !slipUploading && setPaying(null)}>
          <h3 className="mb-2 text-base font-semibold text-brand">
            💰 {t("记录已转账", "Record payment")} {paying.claimCode}
          </h3>
          <p className="mb-3 text-sm text-gray-600">
            {t("转给", "To")} <b>{paying.submittedByName}</b> · <b>{fmtMoney(paying.amount)}</b>
          </p>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm text-gray-600">{t("转账日期", "Transfer date")} *</label>
              <input
                className="input"
                type="date"
                max={todayStr()}
                value={payForm.paidAt}
                onChange={(e) => setPayForm({ ...payForm, paidAt: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-gray-600">{t("银行参考号码（可不填）", "Bank reference no. (optional)")}</label>
              <input
                className="input"
                maxLength={80}
                value={payForm.paidRef}
                onChange={(e) => setPayForm({ ...payForm, paidRef: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-gray-600">{t("转账截图（可不传）", "Transfer slip (optional)")}</label>
              {payForm.paidSlip ? (
                <div className="flex items-center gap-3">
                  <FileThumb url={payForm.paidSlip} onView={setViewing} />
                  <button className="text-sm text-gray-500 underline" onClick={() => setPayForm({ ...payForm, paidSlip: "" })}>
                    {t("移除", "Remove")}
                  </button>
                </div>
              ) : (
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  className="text-sm"
                  disabled={slipUploading}
                  onChange={(e) => {
                    uploadSlip(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              )}
              {slipUploading && <div className="mt-1 text-xs text-gray-400">{t("上传中…", "Uploading…")}</div>}
            </div>
            <button
              className="btn-primary w-full py-2.5"
              disabled={!payForm.paidAt || slipUploading || busy === paying.claimCode}
              onClick={async () => {
                if (await act(paying, { action: "pay", ...payForm })) setPaying(null);
              }}
            >
              {t("确认已转账", "Confirm paid")}
            </button>
          </div>
        </Modal>
      )}

      <ConfirmDialog
        open={!!confirm}
        danger={confirm?.kind !== "approve"}
        title={
          confirm?.kind === "approve"
            ? t("批准报销？", "Approve claim?")
            : confirm?.kind === "unapprove"
              ? t("撤销批准？", "Undo approval?")
              : t("删除报销？", "Delete claim?")
        }
        message={
          confirm ? (
            <div className="text-sm">
              <div>
                {confirm.claim.claimCode} · {confirm.claim.submittedByName} · <b>{fmtMoney(confirm.claim.amount)}</b>
              </div>
              <div className="mt-1 text-gray-500">
                {confirm.kind === "approve"
                  ? t("批准后会自动记入这个单位的支出。", "Approving books it as an expense for this unit.")
                  : confirm.kind === "unapprove"
                    ? t("会回到待审批，并删除已记入的支出。", "It goes back to pending and the booked expense is removed.")
                    : t("删除后不能恢复。", "This can't be undone.")}
              </div>
            </div>
          ) : (
            ""
          )
        }
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          const c = confirm;
          setConfirm(null);
          if (!c) return;
          if (c.kind === "approve") await act(c.claim, { action: "approve" });
          else if (c.kind === "unapprove") await act(c.claim, { action: "unapprove" });
          else await removeClaim(c.claim);
        }}
      />

      {viewing && <Lightbox src={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}
