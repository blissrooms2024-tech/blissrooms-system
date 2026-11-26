"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useToast } from "@/components/Toast";
import { useLanguage } from "@/components/LanguageProvider";
import { fmtMoney } from "@/lib/format";
import { COMPANY, roomStatusLabel } from "@/lib/config";
import { buildQuoteText, computeQuote, defaultCommencement, lineLabel, QUOTE_DEFAULTS, waNumber, type QuoteInput } from "@/lib/quote";
import type { QuoteOptions } from "@/lib/quoteOptions";

const CUSTOM_CARPARK = "__custom__";

function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="mb-1 block text-sm text-gray-600">{label}</label>
      {children}
    </div>
  );
}

const n = (s: string) => (s.trim() === "" ? NaN : Number(s));
const optional = (s: string) => (s.trim() === "" ? null : Number(s));

export default function QuickQuote({ options, today }: { options: QuoteOptions; today: string }) {
  const { t, locale } = useLanguage();
  const toast = useToast();
  const boxRef = useRef<HTMLDivElement>(null);

  const fresh = () => ({
    roomCode: "",
    roomRent: "",
    carpark: "",
    carparkRent: "",
    moveInDate: today,
    commencementDate: defaultCommencement(today),
    startTouched: false,
    chargeProrata: true,
    tenureMonths: String(QUOTE_DEFAULTS.tenureMonths),
    securityMonths: String(QUOTE_DEFAULTS.securityMonths),
    depositIncludesCarpark: QUOTE_DEFAULTS.depositIncludesCarpark as boolean,
    utilitiesMonths: String(QUOTE_DEFAULTS.utilitiesMonths),
    advanceMonths: String(QUOTE_DEFAULTS.advanceMonths),
    accessCardSets: String(QUOTE_DEFAULTS.accessCardSets),
    accessCardPerSet: String(QUOTE_DEFAULTS.accessCardPerSet),
    adminFee: String(QUOTE_DEFAULTS.adminFee),
    securityCustom: "",
    utilitiesCustom: "",
    prorataCustom: "",
    payBy: "",
  });
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(fresh);
  const [showFees, setShowFees] = useState(false);
  const [lang, setLang] = useState<"en" | "zh">("en");
  const [withBank, setWithBank] = useState(true);
  const [agentIdx, setAgentIdx] = useState("");
  const [phone, setPhone] = useState("");

  // The 🧮 shortcut opens and scrolls to this card.
  useEffect(() => {
    const show = () => {
      setOpen(true);
      setTimeout(() => boxRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    };
    window.addEventListener("open-quick-quote", show);
    return () => window.removeEventListener("open-quick-quote", show);
  }, []);

  const room = options.rooms.find((r) => r.roomCode === f.roomCode) ?? null;
  const carparks = useMemo(
    () => (room ? options.carparks.filter((c) => c.propertyId && c.propertyId === room.propertyId) : []),
    [options.carparks, room]
  );
  const selectedCarpark = carparks.find((c) => c.roomCode === f.carpark) ?? null;

  function pickRoom(code: string) {
    const r = options.rooms.find((x) => x.roomCode === code);
    setF((s) => ({ ...s, roomCode: code, roomRent: r ? String(r.rent || "") : "", carpark: "", carparkRent: "" }));
  }
  function pickCarpark(v: string) {
    if (v === CUSTOM_CARPARK) setF((s) => ({ ...s, carpark: v, carparkRent: room && room.carparkRent > 0 ? String(room.carparkRent) : "" }));
    else {
      const c = carparks.find((x) => x.roomCode === v);
      setF((s) => ({ ...s, carpark: v, carparkRent: c ? String(c.rent || "") : "" }));
    }
  }
  function setMoveIn(v: string) {
    setF((s) => ({ ...s, moveInDate: v, commencementDate: s.startTouched ? s.commencementDate : defaultCommencement(v) }));
  }

  const input: QuoteInput | null = room
    ? {
        roomCode: room.roomCode,
        propertyName: room.propertyName,
        roomRent: n(f.roomRent),
        carparkRent: f.carpark ? n(f.carparkRent || "0") : 0,
        carparkLabel: selectedCarpark ? (selectedCarpark.lot ? `Lot ${selectedCarpark.lot}` : selectedCarpark.roomCode) : null,
        depositIncludesCarpark: f.depositIncludesCarpark,
        securityMonths: n(f.securityMonths),
        utilitiesMonths: n(f.utilitiesMonths),
        advanceMonths: n(f.advanceMonths),
        accessCardSets: n(f.accessCardSets),
        accessCardPerSet: n(f.accessCardPerSet),
        adminFee: n(f.adminFee || "0"),
        moveInDate: f.moveInDate,
        commencementDate: f.commencementDate,
        chargeProrata: f.chargeProrata,
        tenureMonths: n(f.tenureMonths || "0"),
        payBy: f.payBy || null,
        overrides: { security: optional(f.securityCustom), utilities: optional(f.utilitiesCustom), prorata: optional(f.prorataCustom) },
      }
    : null;
  const result = input ? computeQuote(input) : null;
  const text =
    input && result?.ok
      ? buildQuoteText(input, result, {
          lang,
          companyName: COMPANY.NAME,
          today,
          bank: withBank ? { name: COMPANY.BANK, accNo: COMPANY.ACC_NO, holder: COMPANY.NAME } : null,
        })
      : "";

  const errorText: Record<string, string> = {
    NO_RENT: t("请填房租", "Please enter the rent"),
    INVALID_NUMBER: t("有数字填错了", "One of the numbers isn't valid"),
    INVALID_DATE: t("日期不对", "Invalid date"),
    START_BEFORE_MOVE_IN: t("起租日期不能早过入住日期", "Tenancy start can't be before move-in"),
    PRORATA_TOO_LONG: t("提早入住超过 3 个月，请检查日期", "Early move-in is over 3 months — check the dates"),
  };

  const wa = waNumber(phone);
  const waHref = text ? `https://wa.me/${wa ?? ""}?text=${encodeURIComponent(text)}` : "#";

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t("报价已复制", "Quote copied"));
    } catch {
      toast.warning(t("复制失败，请手动复制", "Couldn't copy — please copy it manually"));
    }
  }

  const set = (k: keyof ReturnType<typeof fresh>) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));

  if (!open) {
    return (
      <section ref={boxRef} className="flex items-center justify-between gap-3 rounded-xl bg-white p-4 shadow-sm sm:p-5">
        <div>
          <h3 className="text-base font-semibold text-brand">🧮 {t("快速报价", "Quick quote")}</h3>
          <p className="text-xs text-gray-500">
            {t("选房间和入住日期，自动算押金、pro-rata，直接 WhatsApp 给 Agent", "Pick a room and move-in date — deposits and pro-rata are worked out, ready to WhatsApp")}
          </p>
        </div>
        <button onClick={() => setOpen(true)} className="btn-primary shrink-0 py-2.5">
          {t("开始报价", "Start")}
        </button>
      </section>
    );
  }

  return (
    <section ref={boxRef} className="rounded-xl bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-brand">🧮 {t("快速报价", "Quick quote")}</h3>
        <div className="flex gap-2">
          <button onClick={() => setF(fresh())} className="text-xs text-gray-500 underline">
            {t("重新开始", "Reset")}
          </button>
          <button onClick={() => setOpen(false)} className="text-xs text-gray-500 underline">
            {t("收起", "Close")}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t("房间", "Room")} className="sm:col-span-2">
          <select className="input" value={f.roomCode} onChange={(e) => pickRoom(e.target.value)}>
            <option value="">{t("— 选房间 —", "— Choose a room —")}</option>
            {["VACANT", "RESERVED", "OCCUPIED", "MAINTENANCE"].map((st) => {
              const list = options.rooms.filter((r) => r.status === st);
              if (!list.length) return null;
              return (
                <optgroup key={st} label={roomStatusLabel(st, locale)}>
                  {list.map((r) => (
                    <option key={r.roomCode} value={r.roomCode}>
                      {r.roomCode} · {r.propertyName}
                      {r.rent ? ` · ${fmtMoney(r.rent)}` : ""}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>
        </Field>

        {room && (
          <>
            <Field label={t("每月房租 (RM)", "Monthly rent (RM)")}>
              <input className="input" type="number" inputMode="decimal" value={f.roomRent} onChange={set("roomRent")} />
            </Field>
            <Field label={t("车位", "Carpark")}>
              <select className="input" value={f.carpark} onChange={(e) => pickCarpark(e.target.value)}>
                <option value="">{t("没有车位", "No carpark")}</option>
                {carparks.map((c) => (
                  <option key={c.roomCode} value={c.roomCode}>
                    {c.roomCode}
                    {c.lot ? ` · Lot ${c.lot}` : ""}
                    {c.rent ? ` · ${fmtMoney(c.rent)}` : ""}
                  </option>
                ))}
                <option value={CUSTOM_CARPARK}>{t("其他车位（自己填租金）", "Other carpark (enter rent)")}</option>
              </select>
            </Field>
            {f.carpark && (
              <Field label={t("车位月租 (RM)", "Carpark rent (RM)")}>
                <input className="input" type="number" inputMode="decimal" value={f.carparkRent} onChange={set("carparkRent")} />
              </Field>
            )}
            <Field label={t("入住日期", "Move-in date")}>
              <input className="input" type="date" value={f.moveInDate} onChange={(e) => setMoveIn(e.target.value)} />
            </Field>
            <Field label={t("起租日期（第一个完整月）", "Tenancy start (first full month)")}>
              <input
                className="input"
                type="date"
                value={f.commencementDate}
                onChange={(e) => setF((s) => ({ ...s, commencementDate: e.target.value, startTouched: true }))}
              />
            </Field>
            <Field label={t("租期（月）", "Tenure (months)")}>
              <input className="input" type="number" inputMode="numeric" value={f.tenureMonths} onChange={set("tenureMonths")} />
            </Field>
            <label className="flex items-center gap-2 text-sm sm:pt-6">
              <input type="checkbox" checked={f.chargeProrata} onChange={(e) => setF((s) => ({ ...s, chargeProrata: e.target.checked }))} />
              {t("提早入住收 pro-rata 租金", "Charge pro-rata for early move-in")}
            </label>
          </>
        )}
      </div>

      {room && (
        <div className="mt-3">
          <button onClick={() => setShowFees((v) => !v)} className="text-sm font-semibold text-brand">
            {showFees ? "▾" : "▸"} {t("调整押金和费用", "Adjust deposits & fees")}
          </button>
          {showFees && (
            <div className="mt-2 grid grid-cols-2 gap-3 rounded-lg bg-gray-50 p-3 sm:grid-cols-3">
              <Field label={t("押金（月）", "Security deposit (months)")}>
                <input className="input" type="number" inputMode="decimal" step="0.5" value={f.securityMonths} onChange={set("securityMonths")} />
              </Field>
              <Field label={t("或押金固定金额 RM", "Or fixed deposit RM")}>
                <input className="input" type="number" inputMode="decimal" placeholder={t("自动", "auto")} value={f.securityCustom} onChange={set("securityCustom")} />
              </Field>
              <label className="col-span-2 flex items-center gap-2 text-sm sm:col-span-1 sm:pt-6">
                <input type="checkbox" checked={f.depositIncludesCarpark} onChange={(e) => setF((s) => ({ ...s, depositIncludesCarpark: e.target.checked }))} />
                {t("押金也按车位租金算", "Deposit includes carpark rent")}
              </label>
              <Field label={t("水电押金（月）", "Utilities deposit (months)")}>
                <input className="input" type="number" inputMode="decimal" step="0.5" value={f.utilitiesMonths} onChange={set("utilitiesMonths")} />
              </Field>
              <Field label={t("或水电押金 RM", "Or fixed utilities RM")}>
                <input className="input" type="number" inputMode="decimal" placeholder={t("自动", "auto")} value={f.utilitiesCustom} onChange={set("utilitiesCustom")} />
              </Field>
              <Field label={t("预付租金（月）", "Advance rental (months)")}>
                <input className="input" type="number" inputMode="decimal" value={f.advanceMonths} onChange={set("advanceMonths")} />
              </Field>
              <Field label={t("门卡（套）", "Access cards (sets)")}>
                <input className="input" type="number" inputMode="numeric" value={f.accessCardSets} onChange={set("accessCardSets")} />
              </Field>
              <Field label={t("每套门卡 RM", "Per set RM")}>
                <input className="input" type="number" inputMode="decimal" value={f.accessCardPerSet} onChange={set("accessCardPerSet")} />
              </Field>
              <Field label={t("Admin fee RM", "Admin fee RM")}>
                <input className="input" type="number" inputMode="decimal" value={f.adminFee} onChange={set("adminFee")} />
              </Field>
              <Field label={t("或 pro-rata 固定金额 RM", "Or fixed pro-rata RM")}>
                <input className="input" type="number" inputMode="decimal" placeholder={t("自动", "auto")} value={f.prorataCustom} onChange={set("prorataCustom")} />
              </Field>
              <Field label={t("付款期限（可不填）", "Pay by (optional)")}>
                <input className="input" type="date" value={f.payBy} onChange={set("payBy")} />
              </Field>
            </div>
          )}
        </div>
      )}

      {result && !result.ok && <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{errorText[result.error ?? ""] ?? result.error}</div>}

      {result?.ok && (
        <>
          <div className="mt-4 rounded-xl border border-brand/20 bg-brand-light/40 p-3.5">
            <div className="mb-2 text-xs text-gray-500">
              {t("每月租金", "Monthly rental")} {fmtMoney(result.monthlyRent)}
              {result.prorataDays > 0 && ` · ${t(`提早入住 ${result.prorataDays} 天`, `${result.prorataDays} early days`)}`}
            </div>
            <div className="space-y-1 text-sm">
              {result.lines.map((l) => (
                <div key={l.key} className="flex justify-between gap-3">
                  <span className="text-gray-700">{lineLabel(l, locale === "en" ? "en" : "zh")}</span>
                  <span className="shrink-0 font-semibold">{fmtMoney(l.amount)}</span>
                </div>
              ))}
            </div>
            <div className="mt-2 flex items-end justify-between border-t border-brand/20 pt-2">
              <span className="text-sm text-gray-600">{t("交钥匙前总额", "Total before key handover")}</span>
              <span className="text-xl font-bold text-brand">{fmtMoney(result.total)}</span>
            </div>
            <div className="text-right text-xs text-gray-500">
              {t("其中可退还押金", "Refundable deposits")} {fmtMoney(result.refundable)}
            </div>
          </div>

          <div className="mt-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold text-gray-700">📱 {t("发给 Agent 的报价", "Quote message")}</span>
              <div className="flex items-center gap-3 text-xs">
                <div className="flex rounded-lg bg-brand-light p-0.5">
                  {(["en", "zh"] as const).map((l) => (
                    <button key={l} onClick={() => setLang(l)} className={`rounded-md px-2.5 py-1 font-semibold ${lang === l ? "bg-brand text-white" : "text-brand"}`}>
                      {l === "en" ? "English" : "中文"}
                    </button>
                  ))}
                </div>
                <label className="flex items-center gap-1">
                  <input type="checkbox" checked={withBank} onChange={(e) => setWithBank(e.target.checked)} />
                  {t("附银行户口", "Bank details")}
                </label>
              </div>
            </div>
            <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-gray-50 p-3 font-sans text-[13px] leading-relaxed text-gray-800">{text}</pre>
            <p className="mt-1 text-xs text-gray-400">{t("WhatsApp 会把 *星号* 中间的字显示成粗体。", "WhatsApp shows text between *asterisks* in bold.")}</p>

            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <select
                className="input"
                value={agentIdx}
                onChange={(e) => {
                  setAgentIdx(e.target.value);
                  const a = e.target.value === "" ? null : options.agents[Number(e.target.value)];
                  setPhone(a?.phone ?? "");
                }}
              >
                <option value="">{t("— 选 Agent（或自己填号码）—", "— Choose an agent (or type a number) —")}</option>
                {options.agents.map((a, i) => (
                  <option key={`${a.name}-${i}`} value={i}>
                    {a.name}
                    {a.phone ? ` · ${a.phone}` : ` · ${t("没有电话", "no phone")}`}
                  </option>
                ))}
              </select>
              <input className="input" type="tel" inputMode="tel" placeholder={t("WhatsApp 号码，例如 012-345 6789", "WhatsApp no., e.g. 012-345 6789")} value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            {phone && !wa && <div className="mt-1 text-xs text-red-600">{t("号码好像不对，WhatsApp 会让你自己选联系人", "That number doesn't look right — WhatsApp will ask you to pick a chat")}</div>}
            <div className="mt-2 grid grid-cols-2 gap-2">
              <a href={waHref} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1.5 rounded-lg bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90">
                💬 {wa ? t("WhatsApp 发送", "Send on WhatsApp") : t("WhatsApp（选联系人）", "WhatsApp (pick chat)")}
              </a>
              <button onClick={copy} className="btn-soft py-2.5">
                📋 {t("复制文字", "Copy text")}
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
