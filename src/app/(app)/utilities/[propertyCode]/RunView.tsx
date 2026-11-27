"use client";

import { useState } from "react";
import Link from "next/link";
import Pill, { type PillTone } from "@/components/Pill";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useLanguage } from "@/components/LanguageProvider";
import { useToast } from "@/components/Toast";
import { IconChat, IconCopy } from "@/components/icons";
import { fmtDate, fmtMoney } from "@/lib/format";
import { paymentTypeLabelLocale } from "@/lib/config";
import { KIND_LABELS, type UtilityKind } from "@/lib/utilitySplit";
import { whatsappText } from "@/lib/utilityText";
import type { UnitBilling } from "@/lib/utilityBilling";

type Run = NonNullable<UnitBilling["run"]>;
type Details = {
  meters?: { meterId: string; kind: UtilityKind; roomId: string | null; roomCode: string | null; usage: number; amount: number }[];
};

const STATUS: Record<string, { zh: string; en: string; tone: PillTone }> = {
  PENDING: { zh: "未付", en: "Unpaid", tone: "amber" },
  PENDING_REVIEW: { zh: "待审核", en: "To review", tone: "blue" },
  REJECTED: { zh: "被拒绝", en: "Rejected", tone: "rose" },
  Paid: { zh: "已付", en: "Paid", tone: "teal" },
};

/** A month that's already been billed: who owes what, the readings it was based on, the
 * WhatsApp message again, and undo while nothing has been paid yet. */
export default function RunView({ data, run, isAdmin, onChanged }: { data: UnitBilling; run: Run; isAdmin: boolean; onChanged: () => void }) {
  const { t, locale } = useLanguage();
  const toast = useToast();
  const [confirmVoid, setConfirmVoid] = useState(false);
  const details = (run.details ?? {}) as Details;
  const meterById = new Map(data.meters.map((m) => [m.id, m]));

  const byRoom = new Map<string, Run["payments"]>();
  for (const p of run.payments) byRoom.set(p.roomCode, [...(byRoom.get(p.roomCode) ?? []), p]);
  const rooms = [...byRoom.entries()].sort(([a], [b]) => a.localeCompare(b));
  const paid = run.payments.filter((p) => p.status === "Paid").length;
  const canVoid = isAdmin && run.payments.every((p) => p.status === "PENDING");

  const text = whatsappText(
    data.unit.propertyCode,
    data.period,
    (details.meters ?? []).map((m) => ({ kind: m.kind, roomId: m.roomId, usage: m.usage })),
    run.payments.map((p) => ({ roomCode: p.roomCode, amount: p.amountDue })),
    run.dueDate ?? data.period + "-01"
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t("已复制，可以贴到单位的 WhatsApp 群", "Copied — paste it in the unit's WhatsApp group"));
    } catch {
      toast.warning(t("复制失败，请手动复制", "Couldn't copy — please copy it manually"));
    }
  }

  async function doVoid() {
    setConfirmVoid(false);
    const d = await fetch(`/api/utilities/runs/${run.runCode}`, { method: "DELETE" }).then((r) => r.json());
    if (!d.success) return toast.danger(d.message);
    toast.success(d.message);
    onChanged();
  }

  const card = "rounded-[20px] bg-white p-4 shadow-[0_1px_2px_rgba(30,27,46,0.04),0_12px_28px_-18px_rgba(76,29,149,0.22)]";

  return (
    <div className="space-y-4">
      <section className={card}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-gray-500">{t("租客要付", "Billed to tenants")}</p>
            <p className="text-[26px] font-semibold leading-tight text-gray-900">{fmtMoney(run.billedAmount)}</p>
            {run.companyAmount > 0 && <p className="text-xs text-gray-500">{t(`公司承担 ${fmtMoney(run.companyAmount)}`, `Company pays ${fmtMoney(run.companyAmount)}`)}</p>}
          </div>
          <Pill tone={paid === run.payments.length && paid > 0 ? "teal" : "amber"}>{t(`已付 ${paid} / ${run.payments.length}`, `${paid} of ${run.payments.length} paid`)}</Pill>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          {t(`${run.runCode} · 付款期限 ${fmtDate(run.dueDate)} · ${run.createdBy} 开单 · ${run.splitBy === "PEOPLE" ? "电费按人数分" : "按房间分"}`, `${run.runCode} · due ${fmtDate(run.dueDate)} · by ${run.createdBy} · ${run.splitBy === "PEOPLE" ? "electricity split by people" : "split by room"}`)}
        </p>
      </section>

      <section className={card}>
        <h2 className="mb-2 text-[15px] font-semibold text-gray-900">{t("每间房的账单", "Bills by room")}</h2>
        {rooms.length === 0 ? (
          <p className="py-3 text-center text-sm text-gray-400">{t("这个月没有要租客付的", "Nothing billed to tenants this month")}</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {rooms.map(([room, ps]) => (
              <li key={room} className="py-2.5">
                <p className="flex items-baseline justify-between gap-2">
                  <span>
                    <b className="font-semibold">{room}</b> <span className="text-sm text-gray-600">{ps[0].tenantName}</span>
                  </span>
                  <b className="tabular-nums">{fmtMoney(ps.reduce((s, p) => s + p.amountDue, 0))}</b>
                </p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {ps.map((p) => (
                    <span key={p.id} className="flex items-center gap-1 rounded-full bg-gray-50 py-0.5 pl-2.5 pr-1 text-xs text-gray-700">
                      {paymentTypeLabelLocale(p.type, null, locale)} {fmtMoney(p.amountDue)}
                      <Pill tone={STATUS[p.status]?.tone ?? "gray"}>{t(STATUS[p.status]?.zh ?? p.status, STATUS[p.status]?.en ?? p.status)}</Pill>
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={card}>
        <h2 className="mb-2 text-[15px] font-semibold text-gray-900">{t("这个月的读数", "Readings")}</h2>
        <ul className="divide-y divide-gray-100 text-sm">
          {run.readings.map((r) => {
            const m = meterById.get(r.meterId);
            const kind = (m?.kind ?? details.meters?.find((x) => x.meterId === r.meterId)?.kind ?? "ELECTRIC") as UtilityKind;
            return (
              <li key={r.meterId} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0">
                  {t(KIND_LABELS[kind].zh, KIND_LABELS[kind].en)} · {m?.roomCode ?? t("整个单位", "whole unit")}
                  <span className="block text-xs text-gray-500">
                    {r.previous !== null && r.reading !== null ? `${r.previous} → ${r.reading} = ` : ""}
                    {r.usage} {t("度", "kWh")} × RM{r.rate.toFixed(2)}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {r.photoUrl && (
                    <a href={r.photoUrl} target="_blank" rel="noreferrer" className="text-xs font-medium text-brand underline">
                      {t("照片", "Photo")}
                    </a>
                  )}
                  <b className="tabular-nums">{fmtMoney(Math.round(r.usage * r.rate * 100) / 100)}</b>
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className={card}>
        <h2 className="mb-2 text-[15px] font-semibold text-gray-900">{t("WhatsApp 群讯息", "WhatsApp group message")}</h2>
        <pre className="whitespace-pre-wrap rounded-xl bg-[#e7f8ee] p-3 font-sans text-[13px] leading-relaxed text-gray-800">{text}</pre>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" onClick={copy} className="btn-soft flex items-center justify-center gap-1.5 py-2.5">
            <IconCopy size={17} />
            {t("复制", "Copy")}
          </button>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(text)}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-1.5 rounded-lg bg-[#25D366] py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            <IconChat size={18} />
            WhatsApp
          </a>
        </div>
      </section>

      {canVoid && (
        <button type="button" onClick={() => setConfirmVoid(true)} className="w-full rounded-2xl bg-white py-3 text-sm font-semibold text-rose-600 shadow-sm hover:bg-rose-50">
          {t("撤销这次开单（重新抄表）", "Undo these bills (to redo the readings)")}
        </button>
      )}
      {isAdmin && !canVoid && (
        <p className="text-center text-xs text-gray-400">
          {t("已经有人付款或上传交易单，不能整批撤销；个别账单请到", "Some bills are paid or have slips, so the batch can't be undone; fix single bills from")}{" "}
          <Link href="/payments/outstanding" className="text-brand underline">
            {t("未清账单", "Unpaid bills")}
          </Link>
        </p>
      )}

      <ConfirmDialog
        open={confirmVoid}
        danger
        title={t("撤销这次开单", "Undo these bills")}
        message={t(
          `会删除 ${data.unit.propertyCode} ${data.period} 的 ${run.payments.length} 张账单和这个月的读数，然后可以重新抄表开单。已经发出的 email 收不回，记得在 WhatsApp 群说一声。`,
          `This deletes the ${run.payments.length} bills and readings for ${data.unit.propertyCode} ${data.period} so you can bill again. Emails already sent can't be recalled — let the WhatsApp group know.`
        )}
        confirmLabel={t("确定撤销", "Undo")}
        onConfirm={doVoid}
        onCancel={() => setConfirmVoid(false)}
      />
    </div>
  );
}
