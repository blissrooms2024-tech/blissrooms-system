"use client";

import { useState } from "react";
import Sheet from "@/components/Sheet";
import Pill from "@/components/Pill";
import { useLanguage } from "@/components/LanguageProvider";
import { useToast } from "@/components/Toast";
import { IconTrash } from "@/components/icons";
import { fmtDate } from "@/lib/format";
import { KIND_LABELS, type UtilityKind } from "@/lib/utilitySplit";
import type { TenancyRow } from "@/lib/utilityBilling";

/** 豁免 — a tenant who doesn't pay some usage charges for a while. The reason is required; the
 * end date defaults to the end of their contract. Their share is paid by the company. */
export default function ExemptionSheet({
  tenancy,
  kinds,
  period,
  onClose,
  onChanged,
}: {
  tenancy: TenancyRow | null;
  kinds: UtilityKind[];
  period: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { t } = useLanguage();
  const toast = useToast();
  const [picked, setPicked] = useState<UtilityKind[]>([]);
  const [startDate, setStartDate] = useState(`${period}-01`);
  const [untilEnd, setUntilEnd] = useState(true);
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<{ id: string; endDate: string; reason: string } | null>(null);

  const reasons = [t("合同谈好包含", "Included in the deal"), t("维修期间补偿", "Goodwill during repairs"), t("员工 / 自己人", "Staff / family")];

  async function add() {
    if (!tenancy) return;
    if (!reason.trim()) return toast.warning(t("请写豁免的原因", "Please give a reason"));
    setSaving(true);
    try {
      const d = await fetch("/api/utilities/exemptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractCode: tenancy.contractCode, kinds: picked, startDate, endDate: untilEnd ? null : endDate, reason }),
      }).then((r) => r.json());
      if (!d.success) return toast.danger(d.message);
      toast.success(d.message);
      setPicked([]);
      setReason("");
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit() {
    if (!editing) return;
    const d = await fetch(`/api/utilities/exemptions/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endDate: editing.endDate || null, reason: editing.reason }),
    }).then((r) => r.json());
    if (!d.success) return toast.danger(d.message);
    toast.success(d.message);
    setEditing(null);
    onChanged();
  }

  async function remove(id: string) {
    const d = await fetch(`/api/utilities/exemptions/${id}`, { method: "DELETE" }).then((r) => r.json());
    if (!d.success) return toast.danger(d.message);
    toast.success(d.message);
    onChanged();
  }

  const label = (k: UtilityKind) => t(KIND_LABELS[k].zh, KIND_LABELS[k].en);

  return (
    <Sheet open={!!tenancy} onClose={onClose} title={tenancy ? t(`${tenancy.roomCode} ${tenancy.tenantName} 的豁免`, `${tenancy.roomCode} ${tenancy.tenantName} — exemptions`) : ""} tall>
      {tenancy && (
        <>
          <p className="mb-3 text-xs text-gray-500">{t("豁免的那一份由公司承担，其他租客照原本的份额付。", "The company pays the exempt share; other tenants pay the same as before.")}</p>

          {tenancy.exemptions.length > 0 && (
            <ul className="mb-4 divide-y divide-gray-100 rounded-2xl border border-gray-100">
              {tenancy.exemptions.map((e) => (
                <li key={e.id} className="px-3 py-2.5 text-sm">
                  {editing?.id === e.id ? (
                    <div className="space-y-2">
                      <p className="font-medium">{label(e.kind)}</p>
                      <label className="block text-xs text-gray-600">
                        {t("到哪一天（空白 = 到合约结束）", "Until (blank = end of contract)")}
                        <input type="date" value={editing.endDate} onChange={(ev) => setEditing({ ...editing, endDate: ev.target.value })} className="input mt-1" />
                      </label>
                      <input value={editing.reason} onChange={(ev) => setEditing({ ...editing, reason: ev.target.value })} className="input" placeholder={t("原因", "Reason")} />
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setEditing(null)} className="btn-soft flex-1 py-2">
                          {t("取消", "Cancel")}
                        </button>
                        <button type="button" onClick={saveEdit} className="btn-primary flex-1 py-2">
                          {t("保存", "Save")}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-1.5">
                          <b className="font-medium">{label(e.kind)}</b>
                          {e.current ? <Pill tone="teal">{t("这个月有效", "Applies this month")}</Pill> : <Pill>{t("这个月不适用", "Not this month")}</Pill>}
                        </p>
                        <p className="text-xs text-gray-500">
                          {fmtDate(e.startDate)} → {e.endDate ? fmtDate(e.endDate) : t(`合约结束${e.until ? `（${fmtDate(e.until)}）` : ""}`, `end of contract${e.until ? ` (${fmtDate(e.until)})` : ""}`)}
                        </p>
                        <p className="text-xs text-gray-700">{t("原因：", "Reason: ")}{e.reason}</p>
                      </div>
                      <button type="button" onClick={() => setEditing({ id: e.id, endDate: e.endDate ?? "", reason: e.reason })} className="rounded-lg px-2 py-1 text-xs font-medium text-brand hover:bg-brand-light">
                        {t("修改", "Edit")}
                      </button>
                      <button type="button" onClick={() => remove(e.id)} aria-label={t("取消豁免", "Remove")} className="grid h-8 w-8 place-items-center rounded-lg text-gray-400 hover:bg-rose-50 hover:text-rose-600">
                        <IconTrash size={16} />
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          <h3 className="mb-2 text-sm font-semibold text-gray-900">{t("加豁免", "Add an exemption")}</h3>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {kinds.map((k) => {
                const on = picked.includes(k);
                return (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setPicked(on ? picked.filter((x) => x !== k) : [...picked, k])}
                    className={`rounded-full px-3.5 py-2 text-sm font-medium ${on ? "bg-brand text-white" : "bg-gray-100 text-gray-700"}`}
                  >
                    {label(k)}
                  </button>
                );
              })}
            </div>
            <label className="block">
              <span className="mb-1 block text-sm text-gray-600">{t("从哪一天开始", "From")}</span>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input" />
            </label>
            <div>
              <span className="mb-1 block text-sm text-gray-600">{t("到哪一天", "Until")}</span>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" checked={untilEnd} onChange={() => setUntilEnd(true)} />
                {t("到合约结束", "End of contract")}
                {tenancy.expiredDate && <span className="text-gray-500">（{fmtDate(tenancy.expiredDate)}）</span>}
              </label>
              <label className="mt-1.5 flex items-center gap-2 text-sm">
                <input type="radio" checked={!untilEnd} onChange={() => setUntilEnd(false)} />
                {t("到这一天：", "Until:")}
                <input type="date" value={endDate} onChange={(e) => {
                  setEndDate(e.target.value);
                  setUntilEnd(false);
                }} className="input flex-1" />
              </label>
            </div>
            <div>
              <span className="mb-1 block text-sm text-gray-600">{t("原因（一定要写）", "Reason (required)")}</span>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {reasons.map((r) => (
                  <button key={r} type="button" onClick={() => setReason(r)} className={`rounded-full px-3 py-1.5 text-xs font-medium ${reason === r ? "bg-brand text-white" : "bg-gray-100 text-gray-700"}`}>
                    {r}
                  </button>
                ))}
              </div>
              <input value={reason} onChange={(e) => setReason(e.target.value)} className="input" placeholder={t("例如：签约时谈好电费全包", "e.g. electricity included when signing")} />
            </div>
            <button
              type="button"
              onClick={add}
              disabled={saving || picked.length === 0 || !reason.trim() || (!untilEnd && !endDate)}
              className="btn-primary w-full py-2.5"
            >
              {saving ? t("保存中…", "Saving…") : t("设定豁免", "Add exemption")}
            </button>
          </div>
        </>
      )}
    </Sheet>
  );
}
