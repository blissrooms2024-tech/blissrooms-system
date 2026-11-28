"use client";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Sheet from "@/components/Sheet";
import ConfirmDialog from "@/components/ConfirmDialog";
import Lightbox from "@/components/Lightbox";
import { useToast } from "@/components/Toast";
import { useLanguage } from "@/components/LanguageProvider";
import { IconAlert, IconCamera, IconCheck, IconPlus, IconUpload, IconX } from "@/components/icons";
import { fmtDate, fmtMoney } from "@/lib/format";
import { expenseCategoryLabelLocale, MANUAL_EXPENSE_CATEGORIES, type ManualExpenseCategory } from "@/lib/config";
import { isOversized } from "@/lib/imageUpload";
import { groupOf, type Reading, type UnitMatch } from "@/lib/receiptMatch";
import { COMPANY, FileThumb, MAX_RECEIPTS, todayStr, uploadClaimFile } from "./claimFiles";

export interface ClaimUnit {
  propertyCode: string;
  name: string;
  building: string | null;
  unitNo: string | null;
  rooms: { roomCode: string }[];
}

interface SameAs {
  claimCode: string;
  submittedByName: string;
  amount: number;
  expenseDate: string;
  status: string;
}

type ReadState =
  | { s: "idle" }
  | { s: "off" }
  | { s: "reading" }
  | { s: "done"; reading: Reading; unit: UnitMatch; sameAs: SameAs[]; token: string }
  | { s: "failed"; reason: string };

const STATUS_ZH: Record<string, string> = { PENDING: "等审批", APPROVED: "已批准", PAID: "已付款" };
const STATUS_EN: Record<string, string> = { PENDING: "pending", APPROVED: "approved", PAID: "paid" };

function Chip({ on, onClick, children, small }: { on: boolean; onClick: () => void; children: ReactNode; small?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`${small ? "h-7 px-2.5 text-[12.5px]" : "h-8 px-3 text-[13px]"} max-w-full truncate rounded-full font-medium ${
        on ? "bg-brand text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
      }`}
    >
      {children}
    </button>
  );
}

const EMPTY = {
  amount: "",
  date: todayStr(),
  merchant: "",
  receiptNo: "",
  category: "MAINTENANCE" as ManualExpenseCategory,
  customLabel: "",
  notes: "",
};

/**
 * 提交报销, photo first: snap the receipt, Claude reads the amount, date, shop and what was
 * bought (when reading is switched on), and meanwhile the person picks the condo, then the unit.
 * Anything read can still be changed; anything typed by hand is never overwritten by a read.
 */
export default function NewClaimSheet({
  units,
  canRead,
  showReason = false,
  onClose,
  onSubmitted,
}: {
  units: ClaimUnit[];
  canRead: boolean;
  /** Admin sees why a read failed (e.g. api-401 = wrong key), to sort out the set-up. */
  showReason?: boolean;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const { t, locale } = useLanguage();
  const toast = useToast();

  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(0);
  const [read, setRead] = useState<ReadState>({ s: "idle" });
  const [group, setGroup] = useState("");
  const [unit, setUnit] = useState("");
  const [room, setRoom] = useState("");
  const [f, setF] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [dupes, setDupes] = useState<SameAs[] | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  // Fields typed by hand, and whether the unit was picked by hand: a read never overrides those.
  // (The ref is what the read's async callback checks; the state is for showing it.)
  const touched = useRef(new Set<string>());
  const pickedByHand = useRef(false);
  const [byHand, setByHand] = useState(false);
  const readSeq = useRef(0);

  const groups = useMemo(() => {
    const m = new Map<string, ClaimUnit[]>();
    for (const u of units) m.set(groupOf(u), [...(m.get(groupOf(u)) ?? []), u]);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [units]);
  const groupUnits = useMemo(() => groups.find(([g]) => g === group)?.[1] ?? [], [groups, group]);
  const rooms = useMemo(() => units.find((u) => u.propertyCode === unit)?.rooms ?? [], [units, unit]);

  function chooseGroup(g: string, manual: boolean) {
    setGroup(g);
    const list = groups.find(([k]) => k === g)?.[1] ?? [];
    setUnit(list.length === 1 ? list[0].propertyCode : "");
    setRoom("");
    if (manual) markPicked();
  }
  function chooseUnit(u: ClaimUnit, manual: boolean) {
    setGroup(groupOf(u));
    setUnit(u.propertyCode);
    setRoom("");
    if (manual) markPicked();
  }
  function markPicked() {
    pickedByHand.current = true;
    setByHand(true);
  }

  function set<K extends keyof typeof EMPTY>(k: K, v: (typeof EMPTY)[K]) {
    touched.current.add(k);
    setF((prev) => ({ ...prev, [k]: v }));
  }

  // Fill in what was read — but never over something typed by hand.
  function apply(r: Reading, m: UnitMatch) {
    setF((prev) => {
      const next = { ...prev };
      const put = (k: keyof typeof EMPTY, v: string | null) => {
        if (v && !touched.current.has(k)) (next as Record<string, string>)[k] = v;
      };
      put("amount", r.amount != null ? r.amount.toFixed(2) : null);
      put("date", r.date);
      put("merchant", r.merchant);
      put("receiptNo", r.receiptNo);
      if (r.category && !touched.current.has("category")) {
        next.category = r.category as ManualExpenseCategory;
        if (r.category === "OTHER") put("customLabel", r.otherLabel);
      }
      put("notes", r.items);
      return next;
    });
    if (pickedByHand.current) return;
    const u = m.propertyCode ? units.find((x) => x.propertyCode === m.propertyCode) : undefined;
    if (u) chooseUnit(u, false);
    else if (m.building && groups.some(([g]) => g === m.building)) chooseGroup(m.building, false);
  }

  // Read the photos once they're all up (again whenever a page is added or removed).
  useEffect(() => {
    if (!canRead || !photos.length || uploading > 0) return;
    const seq = ++readSeq.current;
    const timer = setTimeout(async () => {
      setRead({ s: "reading" });
      try {
        const res = await fetch("/api/claims/read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ receipts: photos, locale }),
        });
        const data = await res.json();
        if (seq !== readSeq.current) return;
        if (data.success && !data.available) return setRead({ s: "off" });
        if (!data.success || !data.reading) return setRead({ s: "failed", reason: data.reason ?? data.message ?? "" });
        setRead({ s: "done", reading: data.reading, unit: data.unit, sameAs: data.sameAs ?? [], token: data.readToken });
        apply(data.reading, data.unit);
      } catch {
        if (seq === readSeq.current) setRead({ s: "failed", reason: "network" });
      }
    }, 250);
    return () => clearTimeout(timer);
    // apply() reads refs and props that don't change while the sheet is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canRead, photos, uploading, locale]);

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    const list = Array.from(files).slice(0, MAX_RECEIPTS - photos.length - uploading);
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
        const url = await uploadClaimFile(file);
        setPhotos((p) => [...p, url]);
      } catch (e) {
        toast.danger((e as Error).message);
      } finally {
        setUploading((n) => n - 1);
      }
    }
  }

  function removePhoto(u: string) {
    const left = photos.filter((x) => x !== u);
    setPhotos(left);
    if (!left.length) {
      readSeq.current++;
      setRead({ s: "idle" });
    }
  }

  async function submit(allowDuplicate = false) {
    if (!photos.length) return toast.warning(t("先拍单据（或从相册选）", "Snap the receipt first (or pick one)"));
    if (uploading > 0) return toast.warning(t("单据还在上传，请稍等", "Receipts are still uploading"));
    if (!group) return toast.warning(t("选哪个单位（或公司开销）", "Choose the unit (or company)"));
    if (group !== COMPANY && !unit) return toast.warning(t("选单位号码", "Choose the unit number"));
    if (!(Number(f.amount) > 0)) return toast.warning(t("请填金额", "Please enter the amount"));
    if (f.category === "OTHER" && !f.customLabel.trim()) return toast.warning(t("「其他」类型要填支出名称", 'Name the expense for "Other"'));

    setSaving(true);
    try {
      const res = await fetch("/api/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...f,
          expenseDate: f.date,
          propertyCode: group === COMPANY ? "" : unit,
          roomCode: group === COMPANY ? "" : room,
          receipts: photos,
          readToken: read.s === "done" ? read.token : "",
          allowDuplicate,
        }),
      });
      const data = await res.json();
      if (res.status === 409 && data.sameAs) return setDupes(data.sameAs);
      if (!data.success) return toast.danger(data.message);
      toast.success(data.message);
      onSubmitted();
    } catch {
      toast.danger(t("出错，请稍后再试", "Something went wrong — please try again"));
    } finally {
      setSaving(false);
    }
  }

  const done = read.s === "done" ? read : null;
  const readAmount = done?.reading.amount ?? null;
  const amountDiffers = readAmount != null && f.amount !== "" && Math.abs(Number(f.amount) - readAmount) >= 0.01;
  const matched = done && !byHand && done.unit.via && (done.unit.propertyCode ? unit === done.unit.propertyCode : group === done.unit.building);
  const matchedUnit = done?.unit.propertyCode ? units.find((u) => u.propertyCode === done.unit.propertyCode) : undefined;
  const suggestOther = done && byHand && matchedUnit && unit !== matchedUnit.propertyCode;
  const unitLabel = (u: ClaimUnit) => u.unitNo ?? u.name;
  const busy = saving || uploading > 0 || read.s === "reading";
  const dupeLine = (c: SameAs) =>
    `${c.claimCode} · ${c.submittedByName} · ${fmtMoney(c.amount)} · ${fmtDate(c.expenseDate)} · ${
      locale === "en" ? (STATUS_EN[c.status] ?? c.status) : (STATUS_ZH[c.status] ?? c.status)
    }`;

  return (
    <>
      <Sheet open onClose={() => !saving && onClose()} title={t("提交报销", "New claim")} tall>
        <div className="space-y-4">
          {/* 1 — the receipt */}
          {photos.length === 0 && uploading === 0 ? (
            <div className="space-y-2">
              <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-brand/40 bg-brand-light/50 px-4 py-6 text-brand focus-within:ring-4 focus-within:ring-brand/20">
                <IconCamera size={30} />
                <span className="text-[15px] font-semibold">{t("拍单据", "Snap the receipt")}</span>
                {canRead && (
                  <span className="text-center text-xs text-brand/75">
                    {t("金额、日期、店名会自动读出来", "Amount, date and shop fill themselves in")}
                  </span>
                )}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                  onChange={(e) => {
                    addFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
              <label className="flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-gray-100 text-sm font-medium text-gray-700 hover:bg-gray-200 focus-within:ring-4 focus-within:ring-brand/20">
                <IconUpload size={16} />
                {t("从相册 / PDF 选", "From gallery / PDF")}
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  multiple
                  className="sr-only"
                  onChange={(e) => {
                    addFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {photos.map((u) => (
                  <div key={u} className="relative">
                    <FileThumb url={u} onView={setViewing} />
                    <button
                      type="button"
                      onClick={() => removePhoto(u)}
                      className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-gray-800 text-white"
                      aria-label={t("移除", "Remove")}
                    >
                      <IconX size={12} />
                    </button>
                  </div>
                ))}
                {uploading > 0 && (
                  <div className="flex h-16 w-16 animate-pulse items-center justify-center rounded-lg bg-gray-100 text-[11px] text-gray-500">
                    {t("上传中…", "Uploading…")}
                  </div>
                )}
                {photos.length + uploading < MAX_RECEIPTS && (
                  <label className="flex h-16 w-16 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg border-2 border-dashed border-gray-300 text-[11px] text-gray-500 hover:border-brand/50 hover:text-brand">
                    <IconPlus size={18} />
                    {t("加一页", "Add page")}
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      multiple
                      className="sr-only"
                      onChange={(e) => {
                        addFiles(e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </label>
                )}
              </div>

              {read.s === "reading" && (
                <p className="flex items-center gap-2 text-[13px] text-brand" role="status">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-brand/30 border-t-brand" />
                  {t("正在读单据…你可以先选单位", "Reading the receipt… pick the unit meanwhile")}
                </p>
              )}
              {done && done.reading.readable && (
                <p className="flex items-center gap-1.5 text-[13px] text-teal-700" role="status">
                  <IconCheck size={15} />
                  {t("读好了，金额请再看一眼", "Read — please check the amount")}
                </p>
              )}
              {((done && !done.reading.readable) || read.s === "failed") && (
                <p className="flex items-center gap-1.5 text-[13px] text-amber-700" role="status">
                  <IconAlert size={15} />
                  {t("读不到金额，请自己填（或拍清楚一点再加一页）", "Couldn't read the total — type it in (or add a clearer photo)")}
                  {showReason && read.s === "failed" && read.reason && <span className="text-gray-400">({read.reason})</span>}
                </p>
              )}
              {done?.reading.note && <p className="text-xs text-amber-700">{done.reading.note}</p>}
            </div>
          )}

          {done && done.sameAs.length > 0 && (
            <div className="rounded-xl bg-amber-50 px-3 py-2.5 text-[13px] text-amber-900">
              <p className="flex items-center gap-1.5 font-semibold">
                <IconAlert size={15} />
                {t("这张单据好像已经报过", "This receipt may already be claimed")}
              </p>
              {done.sameAs.map((c) => (
                <p key={c.claimCode} className="mt-0.5 text-xs text-amber-800">
                  {dupeLine(c)}
                </p>
              ))}
            </div>
          )}

          {/* 2 — which unit: condo first, then the unit number */}
          <div>
            <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-2">
              <span className="text-sm text-gray-600">{t("哪个单位", "Which unit")}</span>
              {matched && (
                <span className="text-xs text-teal-700">
                  {done!.unit.via === "account"
                    ? t(`按户口号 ${done!.unit.detail} 选好了`, `Picked from account ${done!.unit.detail}`)
                    : t("按单据上的地址选好了", "Picked from the address on the receipt")}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {groups.map(([g]) => (
                <Chip key={g} on={group === g} onClick={() => chooseGroup(g, true)}>
                  {g}
                </Chip>
              ))}
              <Chip on={group === COMPANY} onClick={() => chooseGroup(COMPANY, true)}>
                {t("公司开销", "Company")}
              </Chip>
            </div>

            {group && group !== COMPANY && (
              <div className="mt-2 flex flex-wrap gap-1.5 border-t border-gray-100 pt-2">
                {groupUnits.map((u) => (
                  <Chip key={u.propertyCode} on={unit === u.propertyCode} onClick={() => chooseUnit(u, true)}>
                    {unitLabel(u)}
                    {unitLabel(u) !== u.propertyCode && <span className={unit === u.propertyCode ? "text-white/70" : "text-gray-400"}> {u.propertyCode}</span>}
                  </Chip>
                ))}
              </div>
            )}

            {unit && group !== COMPANY && rooms.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="mr-0.5 text-xs text-gray-500">{t("房间（可不选）", "Room (optional)")}</span>
                <Chip small on={!room} onClick={() => setRoom("")}>
                  {t("整个单位", "Whole unit")}
                </Chip>
                {rooms.map((r) => (
                  <Chip key={r.roomCode} small on={room === r.roomCode} onClick={() => setRoom(r.roomCode)}>
                    {r.roomCode.startsWith(`${unit}-`) ? r.roomCode.slice(unit.length + 1) : r.roomCode}
                  </Chip>
                ))}
              </div>
            )}

            {suggestOther && (
              <p className="mt-2 flex flex-wrap items-center gap-x-2 text-xs text-amber-800">
                {t(
                  `单据上看起来是 ${groupOf(matchedUnit)} · ${unitLabel(matchedUnit)}`,
                  `The receipt looks like ${groupOf(matchedUnit)} · ${unitLabel(matchedUnit)}`
                )}
                <button type="button" onClick={() => chooseUnit(matchedUnit, true)} className="font-semibold text-brand underline">
                  {t("改成这个", "Use it")}
                </button>
              </p>
            )}
          </div>

          {/* 3 — what the receipt says */}
          <div className="space-y-3">
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,9.5rem)] gap-2">
              <label className="block min-w-0">
                <span className="mb-1 block text-sm text-gray-600">{t("金额", "Amount")}</span>
                <span className="relative block">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">RM</span>
                  <input
                    className="input pl-11 text-lg font-semibold"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={f.amount}
                    onChange={(e) => set("amount", e.target.value)}
                  />
                </span>
              </label>
              <label className="block min-w-0">
                <span className="mb-1 block text-sm text-gray-600">{t("日期", "Date")}</span>
                <input className="input" type="date" max={todayStr()} value={f.date} onChange={(e) => set("date", e.target.value)} />
              </label>
            </div>
            {amountDiffers && (
              <p className="-mt-1.5 text-xs text-amber-700">
                {t(`单据上是 ${fmtMoney(readAmount!)}，审批的人会看到你改过`, `The receipt says ${fmtMoney(readAmount!)}; the reviewer will see it was changed`)}
              </p>
            )}

            <div className="grid grid-cols-2 gap-2">
              <label className="block min-w-0">
                <span className="mb-1 block text-sm text-gray-600">{t("店名 / 付给谁", "Shop / paid to")}</span>
                <input className="input" maxLength={80} placeholder={t("例如 MR DIY", "e.g. MR DIY")} value={f.merchant} onChange={(e) => set("merchant", e.target.value)} />
              </label>
              <label className="block min-w-0">
                <span className="mb-1 block text-sm text-gray-600">{t("类别", "Category")}</span>
                <select className="input" value={f.category} onChange={(e) => set("category", e.target.value as ManualExpenseCategory)}>
                  {MANUAL_EXPENSE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {expenseCategoryLabelLocale(c, undefined, locale)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {f.category === "OTHER" && (
              <label className="block">
                <span className="mb-1 block text-sm text-gray-600">{t("支出名称", "Expense name")}</span>
                <input className="input" maxLength={60} placeholder={t("例如 灭虫费", "e.g. Pest control")} value={f.customLabel} onChange={(e) => set("customLabel", e.target.value)} />
              </label>
            )}
            <label className="block">
              <span className="mb-1 block text-sm text-gray-600">
                {t("买了什么 / 备注", "What for / notes")}
                {f.receiptNo && <span className="ml-1.5 text-xs text-gray-400">{t(`单号 ${f.receiptNo}`, `Receipt ${f.receiptNo}`)}</span>}
              </span>
              <textarea
                className="input"
                rows={2}
                maxLength={500}
                placeholder={t("例如 PXC-02 换灯泡", "e.g. New bulbs for PXC-02")}
                value={f.notes}
                onChange={(e) => set("notes", e.target.value)}
              />
            </label>
          </div>

          <button type="button" onClick={() => submit()} disabled={busy} className="btn-primary flex w-full items-center justify-center gap-1.5 py-2.5">
            <IconCheck size={18} />
            {saving
              ? t("提交中…", "Submitting…")
              : uploading > 0
                ? t("上传中…", "Uploading…")
                : read.s === "reading"
                  ? t("正在读单据…", "Reading…")
                  : t("提交报销", "Submit claim")}
          </button>
        </div>
      </Sheet>

      <ConfirmDialog
        open={!!dupes}
        title={t("这张单据好像已经报过", "Already claimed?")}
        message={
          <span className="block space-y-1">
            {dupes?.map((c) => (
              <span key={c.claimCode} className="block">
                {dupeLine(c)}
              </span>
            ))}
            <span className="block pt-1 text-gray-500">{t("确定不是同一张，才提交。", "Only submit if it's a different receipt.")}</span>
          </span>
        }
        confirmLabel={t("还是提交", "Submit anyway")}
        onConfirm={() => {
          setDupes(null);
          submit(true);
        }}
        onCancel={() => setDupes(null)}
      />
      {viewing && <Lightbox src={viewing} onClose={() => setViewing(null)} />}
    </>
  );
}
