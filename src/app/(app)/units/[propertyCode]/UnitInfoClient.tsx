"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Modal from "@/components/Modal";
import ConfirmDialog from "@/components/ConfirmDialog";
import Lightbox from "@/components/Lightbox";
import { useToast } from "@/components/Toast";
import { useLanguage } from "@/components/LanguageProvider";
import { fmtDate, fmtMoney } from "@/lib/format";
import { readAsDataURL } from "@/lib/imageUpload";
import {
  CARD_HOLDER_LABELS,
  CARD_HOLDERS,
  CARD_STATUS_LABELS,
  CARD_STATUSES,
  CARD_TYPE_LABELS,
  CARD_TYPES,
  INFO_GROUPS,
  label,
  PAY_TO,
  PAY_TO_LABELS,
  UTILITY_TYPE_LABELS,
  UTILITY_TYPES,
  type InfoGroup,
} from "@/lib/unitInfo";

interface Card {
  id: string;
  cardType: string;
  serialNo: string | null;
  holder: string;
  roomCode: string | null;
  tenantName: string | null;
  status: string;
  deposit: number | null;
  notes: string | null;
}
interface Utility {
  id: string;
  utilityType: string;
  provider: string | null;
  accountNo: string | null;
  accountHolder: string | null;
  payTo: string;
  fixedAmount: number | null;
  dueDay: number | null;
  nextDue: string | null;
  autoDebit: boolean;
  meterNo: string | null;
  contractEnd: string | null;
  notes: string | null;
}
interface InfoData {
  values: Record<string, string | number | null>;
  secretsSet: Record<string, boolean>;
  photos: string[];
  updatedAt: string | null;
  updatedBy: string | null;
  roomCount: number;
  carparkCount: number;
  rooms: string[];
  cards: Card[];
  utilities: Utility[];
  recentViews: { at: string; by: string | null }[];
}

const emptyCard = { cardType: "ACCESS_CARD", serialNo: "", holder: "OFFICE", roomCode: "", status: "SPARE", deposit: "", notes: "" };
const emptyUtility = {
  utilityType: "ELECTRIC",
  provider: "",
  accountNo: "",
  accountHolder: "",
  payTo: "PROVIDER",
  fixedAmount: "",
  dueDay: "",
  autoDebit: false,
  meterNo: "",
  contractEnd: "",
  notes: "",
};

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="border-t border-gray-100 pt-3.5">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-brand">{title}</h4>
        {action}
      </div>
      {children}
    </div>
  );
}

function Row({ k, children, wide }: { k: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={`min-w-0 ${wide ? "col-span-2 lg:col-span-1" : ""}`}>
      <div className="text-xs text-gray-400">{k}</div>
      <div className="break-words">{children}</div>
    </div>
  );
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  return `${fmtDate(iso)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function UnitInfoClient({ propertyCode }: { propertyCode: string }) {
  const { t, locale } = useLanguage();
  const toast = useToast();
  const base = `/api/properties/${propertyCode}/info`;

  const [data, setData] = useState<InfoData | null>(null);
  const [error, setError] = useState("");
  const [secrets, setSecrets] = useState<Record<string, string | null> | null>(null);
  const [editing, setEditing] = useState<InfoGroup | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [cardForm, setCardForm] = useState<(typeof emptyCard & { id?: string }) | null>(null);
  const [utilForm, setUtilForm] = useState<(typeof emptyUtility & { id?: string }) | null>(null);
  const [deleting, setDeleting] = useState<{ kind: "card" | "utility" | "photo"; id: string; label: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(base);
      const d = await res.json();
      if (!d.success) return setError(d.message);
      setData(d);
    } catch {
      setError(t("出错，请稍后再试", "Something went wrong — please try again later"));
    }
  }, [base, t]);

  useEffect(() => {
    // setState happens after the fetch's await, not synchronously in the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function reveal(): Promise<Record<string, string | null> | null> {
    const res = await fetch(`${base}/reveal`, { method: "POST" });
    const d = await res.json();
    if (!d.success) {
      toast.danger(d.message);
      return null;
    }
    setSecrets(d.secrets);
    load(); // refresh "recently viewed by"
    return d.secrets;
  }

  async function openEdit(g: InfoGroup) {
    let s = secrets;
    if (g.fields.some((f) => f.secret) && !s) {
      s = await reveal();
      if (!s) return;
    }
    const f: Record<string, string> = {};
    for (const fld of g.fields) {
      const v = fld.secret ? s?.[fld.key] : data?.values[fld.key];
      f[fld.key] = v === null || v === undefined ? "" : String(v);
    }
    setForm(f);
    setEditing(g);
  }

  async function saveInfo() {
    setSaving(true);
    try {
      const res = await fetch(base, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: form }),
      });
      const d = await res.json();
      if (!d.success) return toast.danger(d.message);
      toast.success(d.message);
      if (editing?.fields.some((f) => f.secret)) {
        setSecrets((prev) => ({ ...(prev ?? {}), ...Object.fromEntries(editing.fields.filter((f) => f.secret).map((f) => [f.key, form[f.key] || null])) }));
      }
      setEditing(null);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function sendJson(url: string, method: string, body?: unknown) {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const d = await res.json();
    if (d.success) {
      toast.success(d.message);
      load();
    } else toast.danger(d.message);
    return d.success as boolean;
  }

  async function uploadPhotos(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) continue;
        const dataUrl = await readAsDataURL(file);
        const res = await fetch(`${base}/photos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dataUrl }),
        });
        const d = await res.json();
        if (!d.success) {
          toast.danger(d.message);
          break;
        }
      }
      load();
    } finally {
      setUploading(false);
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t("已复制", "Copied"));
    } catch {
      toast.warning(t("复制失败", "Couldn't copy"));
    }
  }

  if (error) return <div className="rounded-xl bg-white p-5 text-sm text-red-600 shadow-sm">{error}</div>;
  if (!data) return <div className="rounded-xl bg-white p-5 text-sm text-gray-500 shadow-sm">{t("载入中...", "Loading...")}</div>;

  const L = (zh: string, en: string) => (locale === "en" ? en : zh);
  const editBtn = (g: InfoGroup) => (
    <button onClick={() => openEdit(g)} className="btn-soft px-3 py-1.5 text-xs">
      ✏️ {t("编辑", "Edit")}
    </button>
  );
  const show = (v: string | number | null | undefined, type?: string) =>
    v === null || v === undefined || v === "" ? <span className="text-gray-300">-</span> : type === "date" ? fmtDate(String(v)) : String(v);

  const cardSummary = CARD_TYPES.map((ct) => {
    const list = data.cards.filter((c) => c.cardType === ct);
    if (!list.length) return null;
    const inUse = list.filter((c) => c.status === "IN_USE").length;
    const spare = list.filter((c) => c.status === "SPARE").length;
    const lost = list.filter((c) => c.status === "LOST").length;
    return { ct, total: list.length, inUse, spare, lost };
  }).filter(Boolean) as { ct: string; total: number; inUse: number; spare: number; lost: number }[];

  return (
    <div className="space-y-3.5 rounded-xl bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-brand">📋 {t("单位资料", "Unit Info")}</h3>
        {data.updatedAt && (
          <span className="text-xs text-gray-400">
            {t("最后更新", "Updated")} {fmtTime(data.updatedAt)} · {data.updatedBy}
          </span>
        )}
      </div>

      {INFO_GROUPS.map((g) => {
        const isSecretGroup = g.fields.some((f) => f.secret);
        return (
          <Section key={g.key} title={L(g.zh, g.en)} action={editBtn(g)}>
            {g.key === "basic" && (
              <div className="mb-2.5 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-brand-light px-2.5 py-1 font-semibold text-brand">
                  🛏️ {t("房间", "Rooms")} {data.roomCount}
                </span>
                {data.carparkCount > 0 && (
                  <span className="rounded-full bg-brand-light px-2.5 py-1 font-semibold text-brand">
                    🚗 {t("出租车位", "Rented carparks")} {data.carparkCount}
                  </span>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 text-sm lg:grid-cols-3">
              {g.fields.map((f) => (
                <Row key={f.key} k={L(f.zh, f.en)} wide={f.type === "textarea" || !!f.secret}>
                  {f.secret ? (
                    secrets ? (
                      secrets[f.key] ? (
                        <span className="flex items-center gap-2">
                          <b className="break-all font-mono">{secrets[f.key]}</b>
                          <button onClick={() => copy(secrets[f.key]!)} className="text-xs text-brand underline">
                            {t("复制", "Copy")}
                          </button>
                        </span>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )
                    ) : data.secretsSet[f.key] ? (
                      <span className="tracking-widest text-gray-500">●●●●●●</span>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )
                  ) : f.type === "textarea" ? (
                    <span className="whitespace-pre-wrap">{show(data.values[f.key])}</span>
                  ) : (
                    show(data.values[f.key], f.type)
                  )}
                </Row>
              ))}
            </div>
            {isSecretGroup && (
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                {secrets ? (
                  <button onClick={() => setSecrets(null)} className="btn-soft px-3 py-1.5 text-xs">
                    🙈 {t("隐藏密码", "Hide passwords")}
                  </button>
                ) : (
                  <button onClick={reveal} className="btn-soft px-3 py-1.5 text-xs">
                    👁 {t("显示密码", "Show passwords")}
                  </button>
                )}
                {data.recentViews.length > 0 && (
                  <span className="text-xs text-gray-400">
                    {t("最近查看", "Recently viewed")}:{" "}
                    {data.recentViews
                      .slice(0, 3)
                      .map((v) => `${v.by ?? "?"} ${fmtTime(v.at)}`)
                      .join(" · ")}
                  </span>
                )}
              </div>
            )}
            {g.key === "owner" && (
              <p className="mt-2 text-xs text-gray-400">
                {t(
                  "管理费、sinking fund、门牌税、地税、火险和屋子保险由屋主负责，这里不记录。",
                  "Maintenance fee, sinking fund, assessment, quit rent and insurance are paid by the owner — not tracked here."
                )}
              </p>
            )}
          </Section>
        );
      })}

      <Section
        title={t("🖼️ 单位照片 / 平面图", "🖼️ Unit photos / floor plan")}
        action={
          <label className={`btn-soft cursor-pointer px-3 py-1.5 text-xs ${uploading ? "opacity-50" : ""}`}>
            {uploading ? t("上传中…", "Uploading…") : `📷 ${t("上传", "Upload")}`}
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                uploadPhotos(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
        }
      >
        {data.photos.length === 0 ? (
          <div className="text-sm text-gray-300">{t("还没有照片", "No photos yet")}</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {data.photos.map((u, i) => (
              <div key={u} className="relative">
                <button onClick={() => setViewing(u)} className="h-20 w-20 overflow-hidden rounded-lg border border-gray-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={u} alt="" className="h-full w-full object-cover" />
                </button>
                <button
                  onClick={() => setDeleting({ kind: "photo", id: u, label: `${t("照片", "Photo")} #${i + 1}` })}
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-gray-800 text-xs text-white"
                  aria-label={t("删除", "Delete")}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section
        title={`${t("🪪 门卡 / RFID / 钥匙", "🪪 Access cards / RFID / keys")} (${data.cards.length})`}
        action={
          <button onClick={() => setCardForm({ ...emptyCard })} className="btn-soft px-3 py-1.5 text-xs">
            ➕ {t("添加", "Add")}
          </button>
        }
      >
        {cardSummary.length > 0 && (
          <div className="mb-2.5 flex flex-wrap gap-2 text-xs">
            {cardSummary.map((s) => (
              <span key={s.ct} className="rounded-full bg-gray-100 px-2.5 py-1">
                <b>
                  {label(CARD_TYPE_LABELS, s.ct, locale)} {s.total}
                </b>{" "}
                ({t("使用中", "in use")} {s.inUse} · {t("备用", "spare")} {s.spare}
                {s.lost ? ` · ${t("遗失", "lost")} ${s.lost}` : ""})
              </span>
            ))}
          </div>
        )}
        {data.cards.length === 0 ? (
          <div className="text-sm text-gray-300">{t("还没有记录", "Nothing recorded yet")}</div>
        ) : (
          <div className="divide-y divide-gray-100 rounded-lg border border-gray-100">
            {data.cards.map((c) => (
              <button
                key={c.id}
                onClick={() =>
                  setCardForm({
                    id: c.id,
                    cardType: c.cardType,
                    serialNo: c.serialNo ?? "",
                    holder: c.holder,
                    roomCode: c.roomCode ?? "",
                    status: c.status,
                    deposit: c.deposit === null ? "" : String(c.deposit),
                    notes: c.notes ?? "",
                  })
                }
                className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm hover:bg-gray-50"
              >
                <div className="min-w-0">
                  <div>
                    <b>{label(CARD_TYPE_LABELS, c.cardType, locale)}</b>{" "}
                    <span className="font-mono text-gray-600">{c.serialNo || "-"}</span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {c.holder === "ROOM"
                      ? `🛏️ ${c.roomCode}${c.tenantName ? ` · ${c.tenantName}` : ""}`
                      : label(CARD_HOLDER_LABELS, c.holder, locale)}
                    {c.deposit ? ` · ${t("押金", "Deposit")} ${fmtMoney(c.deposit)}` : ""}
                    {c.notes ? ` · ${c.notes}` : ""}
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                    c.status === "IN_USE" ? "bg-green-100 text-green-800" : c.status === "LOST" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {label(CARD_STATUS_LABELS, c.status, locale)}
                </span>
              </button>
            ))}
          </div>
        )}
      </Section>

      <Section
        title={`${t("🧾 水电网账户", "🧾 Utility accounts")} (${data.utilities.length})`}
        action={
          <button onClick={() => setUtilForm({ ...emptyUtility })} className="btn-soft px-3 py-1.5 text-xs">
            ➕ {t("添加", "Add")}
          </button>
        }
      >
        {data.utilities.length === 0 ? (
          <div className="text-sm text-gray-300">{t("还没有记录", "Nothing recorded yet")}</div>
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2">
            {data.utilities.map((u) => (
              <button
                key={u.id}
                onClick={() =>
                  setUtilForm({
                    id: u.id,
                    utilityType: u.utilityType,
                    provider: u.provider ?? "",
                    accountNo: u.accountNo ?? "",
                    accountHolder: u.accountHolder ?? "",
                    payTo: u.payTo,
                    fixedAmount: u.fixedAmount === null ? "" : String(u.fixedAmount),
                    dueDay: u.dueDay === null ? "" : String(u.dueDay),
                    autoDebit: u.autoDebit,
                    meterNo: u.meterNo ?? "",
                    contractEnd: u.contractEnd ?? "",
                    notes: u.notes ?? "",
                  })
                }
                className="rounded-lg border border-gray-100 p-3 text-left text-sm hover:bg-gray-50"
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <b>{label(UTILITY_TYPE_LABELS, u.utilityType, locale)}</b>
                  <span className="text-xs text-gray-500">{label(PAY_TO_LABELS, u.payTo, locale)}</span>
                </div>
                <div className="text-gray-700">
                  {u.provider || "-"} · <span className="font-mono">{u.accountNo || "-"}</span>
                </div>
                {u.accountHolder && <div className="text-xs text-gray-500">{t("户主", "Holder")}: {u.accountHolder}</div>}
                <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-gray-600">
                  <span>{u.fixedAmount !== null ? `${fmtMoney(u.fixedAmount)}/${t("月", "mo")}` : t("金额每月不同", "Varies monthly")}</span>
                  {u.dueDay && (
                    <span>
                      {t("每月", "Due day")} {u.dueDay} {t("号到期", "")} · {t("下次", "next")} {fmtDate(u.nextDue)}
                    </span>
                  )}
                  {u.autoDebit && <span className="text-green-700">✓ {t("自动扣款", "Auto-debit")}</span>}
                </div>
                {(u.meterNo || u.contractEnd) && (
                  <div className="text-xs text-gray-500">
                    {u.meterNo && `${t("电表/水表", "Meter")} ${u.meterNo}`}
                    {u.meterNo && u.contractEnd && " · "}
                    {u.contractEnd && `${t("合约到期", "Contract ends")} ${fmtDate(u.contractEnd)}`}
                  </div>
                )}
                {u.notes && <div className="text-xs text-gray-500">📝 {u.notes}</div>}
              </button>
            ))}
          </div>
        )}
      </Section>

      {editing && (
        <Modal onClose={() => !saving && setEditing(null)}>
          <h3 className="mb-3 text-base font-semibold text-brand">
            ✏️ {L(editing.zh, editing.en)}
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {editing.fields.map((f) => (
              <div key={f.key} className={f.type === "textarea" ? "sm:col-span-2" : ""}>
                <label className="mb-1 block text-sm text-gray-600">{L(f.zh, f.en)}</label>
                {f.type === "textarea" ? (
                  <textarea
                    className="input"
                    rows={3}
                    value={form[f.key] ?? ""}
                    placeholder={f.placeholder}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  />
                ) : (
                  <input
                    className="input"
                    type={f.type === "int" ? "number" : f.type === "date" ? "date" : "text"}
                    inputMode={f.type === "int" ? "numeric" : undefined}
                    autoComplete="off"
                    value={form[f.key] ?? ""}
                    placeholder={f.placeholder}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  />
                )}
              </div>
            ))}
          </div>
          <button onClick={saveInfo} disabled={saving} className="btn-primary mt-4 w-full py-2.5">
            {saving ? t("保存中…", "Saving…") : t("保存", "Save")}
          </button>
        </Modal>
      )}

      {cardForm && (
        <Modal onClose={() => setCardForm(null)}>
          <h3 className="mb-3 text-base font-semibold text-brand">
            🪪 {cardForm.id ? t("编辑", "Edit") : t("添加", "Add")}
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t("类型", "Type")}>
              <select className="input" value={cardForm.cardType} onChange={(e) => setCardForm({ ...cardForm, cardType: e.target.value })}>
                {CARD_TYPES.map((x) => (
                  <option key={x} value={x}>
                    {label(CARD_TYPE_LABELS, x, locale)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("Serial number / 编号", "Serial number")}>
              <input className="input font-mono" value={cardForm.serialNo} onChange={(e) => setCardForm({ ...cardForm, serialNo: e.target.value })} />
            </Field>
            <Field label={t("在谁手上", "Held by")}>
              <select className="input" value={cardForm.holder} onChange={(e) => setCardForm({ ...cardForm, holder: e.target.value })}>
                {CARD_HOLDERS.map((x) => (
                  <option key={x} value={x}>
                    {label(CARD_HOLDER_LABELS, x, locale)}
                  </option>
                ))}
              </select>
            </Field>
            {cardForm.holder === "ROOM" && (
              <Field label={t("房间", "Room")}>
                <select className="input" value={cardForm.roomCode} onChange={(e) => setCardForm({ ...cardForm, roomCode: e.target.value })}>
                  <option value="">{t("— 请选择 —", "— Choose —")}</option>
                  {data.rooms.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <Field label={t("状态", "Status")}>
              <select className="input" value={cardForm.status} onChange={(e) => setCardForm({ ...cardForm, status: e.target.value })}>
                {CARD_STATUSES.map((x) => (
                  <option key={x} value={x}>
                    {label(CARD_STATUS_LABELS, x, locale)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("押金 RM（可不填）", "Deposit RM (optional)")}>
              <input className="input" type="number" inputMode="decimal" value={cardForm.deposit} onChange={(e) => setCardForm({ ...cardForm, deposit: e.target.value })} />
            </Field>
            <div className="sm:col-span-2">
              <Field label={t("备注", "Notes")}>
                <input className="input" value={cardForm.notes} onChange={(e) => setCardForm({ ...cardForm, notes: e.target.value })} />
              </Field>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              className="btn-primary flex-1 py-2.5"
              onClick={async () => {
                const { id, ...body } = cardForm;
                if (await sendJson(id ? `${base}/cards/${id}` : `${base}/cards`, id ? "PUT" : "POST", body)) setCardForm(null);
              }}
            >
              {t("保存", "Save")}
            </button>
            {cardForm.id && (
              <button
                className="rounded-lg bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600"
                onClick={() => {
                  setDeleting({ kind: "card", id: cardForm.id!, label: `${label(CARD_TYPE_LABELS, cardForm.cardType, locale)} ${cardForm.serialNo}` });
                  setCardForm(null);
                }}
              >
                🗑️
              </button>
            )}
          </div>
        </Modal>
      )}

      {utilForm && (
        <Modal onClose={() => setUtilForm(null)}>
          <h3 className="mb-3 text-base font-semibold text-brand">
            🧾 {utilForm.id ? t("编辑", "Edit") : t("添加", "Add")}
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t("类型", "Type")}>
              <select className="input" value={utilForm.utilityType} onChange={(e) => setUtilForm({ ...utilForm, utilityType: e.target.value })}>
                {UTILITY_TYPES.map((x) => (
                  <option key={x} value={x}>
                    {label(UTILITY_TYPE_LABELS, x, locale)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("付给谁", "Paid to")}>
              <select className="input" value={utilForm.payTo} onChange={(e) => setUtilForm({ ...utilForm, payTo: e.target.value })}>
                {PAY_TO.map((x) => (
                  <option key={x} value={x}>
                    {label(PAY_TO_LABELS, x, locale)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("供应商", "Provider")}>
              <input
                className="input"
                placeholder="TNB / Air Selangor / PBAPP / IWK / TIME / Unifi"
                value={utilForm.provider}
                onChange={(e) => setUtilForm({ ...utilForm, provider: e.target.value })}
              />
            </Field>
            <Field label={t("账户号码", "Account no.")}>
              <input className="input font-mono" value={utilForm.accountNo} onChange={(e) => setUtilForm({ ...utilForm, accountNo: e.target.value })} />
            </Field>
            <Field label={t("户主名字", "Account holder")}>
              <input className="input" value={utilForm.accountHolder} onChange={(e) => setUtilForm({ ...utilForm, accountHolder: e.target.value })} />
            </Field>
            <Field label={t("每月固定金额 RM（每月不同就留空）", "Fixed monthly RM (blank if it varies)")}>
              <input className="input" type="number" inputMode="decimal" value={utilForm.fixedAmount} onChange={(e) => setUtilForm({ ...utilForm, fixedAmount: e.target.value })} />
            </Field>
            <Field label={t("每月几号到期 (1–31)", "Due day of month (1–31)")}>
              <input className="input" type="number" inputMode="numeric" min={1} max={31} value={utilForm.dueDay} onChange={(e) => setUtilForm({ ...utilForm, dueDay: e.target.value })} />
            </Field>
            <Field label={t("电表 / 水表号码", "Meter no.")}>
              <input className="input font-mono" value={utilForm.meterNo} onChange={(e) => setUtilForm({ ...utilForm, meterNo: e.target.value })} />
            </Field>
            <Field label={t("合约到期（例如 WiFi 24 个月）", "Contract end (e.g. 24-month WiFi)")}>
              <input className="input" type="date" value={utilForm.contractEnd} onChange={(e) => setUtilForm({ ...utilForm, contractEnd: e.target.value })} />
            </Field>
            <label className="flex items-center gap-2 text-sm sm:pt-6">
              <input type="checkbox" checked={utilForm.autoDebit} onChange={(e) => setUtilForm({ ...utilForm, autoDebit: e.target.checked })} />
              {t("自动扣款 (auto-debit)", "Auto-debit")}
            </label>
            <div className="sm:col-span-2">
              <Field label={t("备注", "Notes")}>
                <input className="input" value={utilForm.notes} onChange={(e) => setUtilForm({ ...utilForm, notes: e.target.value })} />
              </Field>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              className="btn-primary flex-1 py-2.5"
              onClick={async () => {
                const { id, ...body } = utilForm;
                if (await sendJson(id ? `${base}/utilities/${id}` : `${base}/utilities`, id ? "PUT" : "POST", body)) setUtilForm(null);
              }}
            >
              {t("保存", "Save")}
            </button>
            {utilForm.id && (
              <button
                className="rounded-lg bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600"
                onClick={() => {
                  setDeleting({ kind: "utility", id: utilForm.id!, label: `${label(UTILITY_TYPE_LABELS, utilForm.utilityType, locale)} ${utilForm.accountNo}` });
                  setUtilForm(null);
                }}
              >
                🗑️
              </button>
            )}
          </div>
        </Modal>
      )}

      <ConfirmDialog
        open={!!deleting}
        danger
        title={t("确定删除？", "Delete?")}
        message={deleting?.label ?? ""}
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          const d = deleting;
          setDeleting(null);
          if (!d) return;
          if (d.kind === "card") await sendJson(`${base}/cards/${d.id}`, "DELETE");
          else if (d.kind === "utility") await sendJson(`${base}/utilities/${d.id}`, "DELETE");
          else await sendJson(`${base}/photos`, "DELETE", { url: d.id });
        }}
      />

      {viewing && <Lightbox src={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm text-gray-600">{label}</label>
      {children}
    </div>
  );
}
