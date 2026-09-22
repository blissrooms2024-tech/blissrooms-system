"use client";

import { useEffect, useState, useCallback } from "react";
import { useToast } from "@/components/Toast";
import { useLanguage } from "@/components/LanguageProvider";
import { paymentTypeLabelLocale } from "@/lib/config";

interface PropertyOption {
  propertyCode: string;
  name: string;
}
interface TenantOption {
  contractCode: string;
  roomCode: string;
  tenantName: string;
  hasAircon: boolean;
}

const BULK_TYPES = ["ELECTRIC", "UTILITIES", "AC", "DRYER", "OTHER"] as const;

export default function BulkBillClient() {
  const toast = useToast();
  const { locale, t } = useLanguage();
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [propertyCode, setPropertyCode] = useState("");
  const [tenants, setTenants] = useState<TenantOption[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({
    type: "ELECTRIC",
    customLabel: "",
    amount: "",
    dueDate: "",
    periodMonth: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/properties");
      const data = await res.json();
      if (data.success) setProperties(data.properties);
    })();
  }, []);

  const loadTenants = useCallback(async (code: string) => {
    setTenants(null);
    if (!code) return;
    const res = await fetch(`/api/properties/${code}/active-tenants`);
    const data = await res.json();
    if (!data.success) {
      toast.danger(data.message);
      return;
    }
    setTenants(data.tenants);
    setSelected(new Set((data.tenants as TenantOption[]).map((tn) => tn.contractCode)));
  }, [toast]);

  function toggle(code: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  async function submit() {
    if (!propertyCode) {
      toast.warning(t("请先选楼盘", "Please select a unit first"));
      return;
    }
    if (!form.amount || Number(form.amount) <= 0 || !form.dueDate) {
      toast.warning(t("金额和到期日一定要填", "Amount and due date are required"));
      return;
    }
    if (form.type === "OTHER" && !form.customLabel.trim()) {
      toast.warning(t("「其他」类型要填费用名称", "Please enter a fee name for the \"Other\" type"));
      return;
    }
    if (selected.size === 0) {
      toast.warning(t("请至少选一位租客", "Please select at least one tenant"));
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/payments/bulk-bill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: form.type,
          customLabel: form.customLabel,
          amount: form.amount,
          dueDate: form.dueDate,
          periodMonth: form.periodMonth,
          notes: form.notes,
          contractCodes: [...selected],
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setForm((f) => ({ ...f, amount: "", dueDate: "", periodMonth: "", notes: "", customLabel: "" }));
      } else {
        toast.danger(data.message);
      }
    } catch {
      toast.danger(t("系统出错，请稍后再试", "System error — please try again later"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-xl bg-white p-5 shadow-sm">
      <h3 className="mb-1 text-base font-semibold text-brand">{t("📢 批量开账单", "📢 Bulk Bill Generation")}</h3>
      <p className="mb-3.5 text-xs text-gray-400">
        {t(
          "选一个楼盘，同一笔金额一次开给底下所有已出租房间的租客，例如楼盘整体电费。",
          "Pick a unit and issue the same amount to every tenant in its occupied rooms at once — e.g. a shared electricity bill for the whole unit."
        )}
      </p>

      <div className="mb-3.5">
        <label className="mb-1.5 block text-sm text-gray-600">{t("楼盘 Unit", "Unit")}</label>
        <select
          value={propertyCode}
          onChange={(e) => {
            setPropertyCode(e.target.value);
            loadTenants(e.target.value);
          }}
          className="input max-w-xs"
        >
          <option value="">{t("-- 选楼盘 --", "-- Select Unit --")}</option>
          {properties.map((p) => (
            <option key={p.propertyCode} value={p.propertyCode}>
              {p.propertyCode} ({p.name})
            </option>
          ))}
        </select>
      </div>

      {propertyCode && (
        <>
          {!tenants && <div className="text-sm text-gray-500">{t("载入租客中...", "Loading tenants...")}</div>}
          {tenants && tenants.length === 0 && (
            <div className="rounded-lg border border-dashed border-gray-300 py-8 text-center">
              <div className="text-2xl">🈳</div>
              <div className="mt-1.5 text-sm font-semibold text-gray-600">
                {t("这个楼盘现在没有生效中的租客", "This unit has no active tenants right now")}
              </div>
              <div className="mt-0.5 text-xs text-gray-400">
                {t("没有人可以开账单，换一个楼盘试试", "There's no one to bill — try a different unit")}
              </div>
            </div>
          )}
          {tenants && tenants.length > 0 && (
            <>
              <div className="mb-3.5 flex flex-wrap items-end gap-2.5">
                <div className="min-w-[110px] flex-1">
                  <label className="mb-1.5 block text-sm text-gray-600">{t("项目", "Item")}</label>
                  <select
                    className="input"
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                  >
                    {BULK_TYPES.map((bt) => (
                      <option key={bt} value={bt}>
                        {paymentTypeLabelLocale(bt, undefined, locale)}
                      </option>
                    ))}
                  </select>
                </div>
                {form.type === "OTHER" && (
                  <div className="min-w-[110px] flex-1">
                    <label className="mb-1.5 block text-sm text-gray-600">{t("费用名称", "Fee Name")}</label>
                    <input
                      className="input"
                      placeholder={t("例: 清洁费", "e.g. Cleaning Fee")}
                      value={form.customLabel}
                      onChange={(e) => setForm({ ...form, customLabel: e.target.value })}
                    />
                  </div>
                )}
                <div className="min-w-[110px] flex-1">
                  <label className="mb-1.5 block text-sm text-gray-600">{t("金额 RM (每人)", "Amount RM (per person)")}</label>
                  <input
                    type="number"
                    className="input"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  />
                </div>
                <div className="min-w-[130px] flex-1">
                  <label className="mb-1.5 block text-sm text-gray-600">{t("到期日", "Due Date")}</label>
                  <input
                    type="date"
                    className="input"
                    value={form.dueDate}
                    onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                  />
                </div>
                <div className="min-w-[110px] flex-1">
                  <label className="mb-1.5 block text-sm text-gray-600">{t("月份 (选填)", "Month (optional)")}</label>
                  <input
                    type="month"
                    className="input"
                    value={form.periodMonth}
                    onChange={(e) => setForm({ ...form, periodMonth: e.target.value })}
                  />
                </div>
              </div>

              <div className="mb-1.5 flex items-center justify-between">
                <b className="text-sm">
                  {t("选租客", "Select Tenants")} ({selected.size}/{tenants.length})
                </b>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSelected(new Set(tenants.map((tn) => tn.contractCode)))}
                    className="text-xs font-semibold text-brand underline"
                  >
                    {t("全选", "Select All")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelected(new Set())}
                    className="text-xs font-semibold text-gray-500 underline"
                  >
                    {t("全不选", "Deselect All")}
                  </button>
                </div>
              </div>
              <div className="mb-3.5 max-h-[260px] space-y-1.5 overflow-y-auto rounded-lg border border-gray-200 p-2.5">
                {tenants.map((tn) => (
                  <label
                    key={tn.contractCode}
                    className="flex items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(tn.contractCode)}
                      onChange={() => toggle(tn.contractCode)}
                    />
                    <span>
                      {tn.contractCode} · {tn.roomCode} · {tn.tenantName}
                    </span>
                    {form.type === "AC" && (
                      <span className={tn.hasAircon ? "text-xs text-sky-600" : "text-xs text-red-500"}>
                        {tn.hasAircon ? t("❄️ 有冷气", "❄️ Has A/C") : t("⚠️ 无冷气", "⚠️ No A/C")}
                      </span>
                    )}
                  </label>
                ))}
              </div>
              <button onClick={submit} disabled={submitting} className="btn-primary">
                {submitting ? t("开账单中...", "Issuing bills...") : t(`开账单 (${selected.size} 人)`, `Issue Bills (${selected.size})`)}
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}
