"use client";

import { useEffect, useState, useCallback } from "react";
import { useToast } from "@/components/Toast";
import { PAYMENT_TYPE_LABELS } from "@/lib/config";

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
    setSelected(new Set((data.tenants as TenantOption[]).map((t) => t.contractCode)));
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
      toast.warning("请先选楼盘");
      return;
    }
    if (!form.amount || Number(form.amount) <= 0 || !form.dueDate) {
      toast.warning("金额和到期日一定要填");
      return;
    }
    if (form.type === "OTHER" && !form.customLabel.trim()) {
      toast.warning("「其他」类型要填费用名称");
      return;
    }
    if (selected.size === 0) {
      toast.warning("请至少选一位租客");
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
      toast.danger("系统出错，请稍后再试");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-xl bg-white p-5 shadow-sm">
      <h3 className="mb-1 text-base font-semibold text-brand">📢 批量开账单</h3>
      <p className="mb-3.5 text-xs text-gray-400">
        选一个楼盘，同一笔金额一次开给底下所有已出租房间的租客，例如楼盘整体电费。
      </p>

      <div className="mb-3.5">
        <label className="mb-1.5 block text-sm text-gray-600">楼盘 Unit</label>
        <select
          value={propertyCode}
          onChange={(e) => {
            setPropertyCode(e.target.value);
            loadTenants(e.target.value);
          }}
          className="input max-w-xs"
        >
          <option value="">-- 选楼盘 --</option>
          {properties.map((p) => (
            <option key={p.propertyCode} value={p.propertyCode}>
              {p.propertyCode} ({p.name})
            </option>
          ))}
        </select>
      </div>

      {propertyCode && (
        <>
          {!tenants && <div className="text-sm text-gray-500">载入租客中...</div>}
          {tenants && tenants.length === 0 && (
            <div className="rounded-lg border border-dashed border-gray-300 py-8 text-center">
              <div className="text-2xl">🈳</div>
              <div className="mt-1.5 text-sm font-semibold text-gray-600">这个楼盘现在没有生效中的租客</div>
              <div className="mt-0.5 text-xs text-gray-400">没有人可以开账单，换一个楼盘试试</div>
            </div>
          )}
          {tenants && tenants.length > 0 && (
            <>
              <div className="mb-3.5 flex flex-wrap items-end gap-2.5">
                <div className="min-w-[110px] flex-1">
                  <label className="mb-1.5 block text-sm text-gray-600">项目</label>
                  <select
                    className="input"
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                  >
                    {BULK_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {PAYMENT_TYPE_LABELS[t] ?? t}
                      </option>
                    ))}
                  </select>
                </div>
                {form.type === "OTHER" && (
                  <div className="min-w-[110px] flex-1">
                    <label className="mb-1.5 block text-sm text-gray-600">费用名称</label>
                    <input
                      className="input"
                      placeholder="例: 清洁费"
                      value={form.customLabel}
                      onChange={(e) => setForm({ ...form, customLabel: e.target.value })}
                    />
                  </div>
                )}
                <div className="min-w-[110px] flex-1">
                  <label className="mb-1.5 block text-sm text-gray-600">金额 RM (每人)</label>
                  <input
                    type="number"
                    className="input"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  />
                </div>
                <div className="min-w-[130px] flex-1">
                  <label className="mb-1.5 block text-sm text-gray-600">到期日</label>
                  <input
                    type="date"
                    className="input"
                    value={form.dueDate}
                    onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                  />
                </div>
                <div className="min-w-[110px] flex-1">
                  <label className="mb-1.5 block text-sm text-gray-600">月份 (选填)</label>
                  <input
                    type="month"
                    className="input"
                    value={form.periodMonth}
                    onChange={(e) => setForm({ ...form, periodMonth: e.target.value })}
                  />
                </div>
              </div>

              <div className="mb-1.5 flex items-center justify-between">
                <b className="text-sm">选租客 ({selected.size}/{tenants.length})</b>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSelected(new Set(tenants.map((t) => t.contractCode)))}
                    className="text-xs font-semibold text-brand underline"
                  >
                    全选
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelected(new Set())}
                    className="text-xs font-semibold text-gray-500 underline"
                  >
                    全不选
                  </button>
                </div>
              </div>
              <div className="mb-3.5 max-h-[260px] space-y-1.5 overflow-y-auto rounded-lg border border-gray-200 p-2.5">
                {tenants.map((t) => (
                  <label
                    key={t.contractCode}
                    className="flex items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(t.contractCode)}
                      onChange={() => toggle(t.contractCode)}
                    />
                    <span>
                      {t.contractCode} · {t.roomCode} · {t.tenantName}
                    </span>
                    {form.type === "AC" && (
                      <span className={t.hasAircon ? "text-xs text-sky-600" : "text-xs text-red-500"}>
                        {t.hasAircon ? "❄️ 有冷气" : "⚠️ 无冷气"}
                      </span>
                    )}
                  </label>
                ))}
              </div>
              <button onClick={submit} disabled={submitting} className="btn-primary">
                {submitting ? "开账单中..." : `开账单 (${selected.size} 人)`}
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}
