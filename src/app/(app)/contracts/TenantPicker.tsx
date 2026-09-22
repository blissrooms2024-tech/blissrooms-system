"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/Toast";
import { useT } from "@/components/LanguageProvider";

export interface TenantOption {
  userCode: string;
  name: string;
  ic: string | null;
  email: string;
  phone: string | null;
}

export default function TenantPicker({
  value,
  onChange,
  error,
}: {
  value: TenantOption | null;
  onChange: (tenant: TenantOption | null) => void;
  error?: boolean;
}) {
  const toast = useToast();
  const t = useT();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<TenantOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTenant, setNewTenant] = useState({ name: "", ic: "", email: "", phone: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!q.trim()) return;
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/tenants?q=${encodeURIComponent(q.trim())}`);
        const data = await res.json();
        setResults(data.success ? data.tenants : []);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  async function submitNewTenant() {
    if (!newTenant.name.trim() || !newTenant.ic.trim() || !newTenant.email.trim()) {
      toast.warning(t("姓名/IC/Email 一定要填", "Name/IC/Email are all required"));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTenant),
      });
      const data = await res.json();
      if (!data.success) {
        toast.danger(data.message);
        return;
      }
      toast.success(data.message);
      onChange(data.tenant);
      setCreating(false);
      setNewTenant({ name: "", ic: "", email: "", phone: "" });
      setQ("");
      setResults([]);
    } catch {
      toast.danger(t("系统出错，请稍后再试", "System error — please try again later"));
    } finally {
      setSaving(false);
    }
  }

  if (value) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-brand-light bg-brand-light/60 px-3 py-2 text-sm">
        <span className="font-semibold text-brand">{value.name}</span>
        <span className="text-gray-500">{value.ic}</span>
        <span className="text-gray-400">·</span>
        <span className="text-gray-500">{value.email}</span>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="ml-auto text-xs font-semibold text-brand underline hover:text-brand-dark"
        >
          {t("换一个", "Change")}
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        className={`input ${error ? "border-red-500 ring-1 ring-red-500" : ""}`}
        placeholder={t("输入 IC / 姓名 / Email 搜索租客", "Enter IC / Name / Email to search tenants")}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {q.trim() && (
        <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
          {searching && <div className="px-3 py-2 text-sm text-gray-400">{t("搜索中...", "Searching...")}</div>}
          {!searching && results.length === 0 && (
            <div className="px-3 py-2 text-sm text-gray-400">{t("没找到，可以新建租客资料", "Not found — you can create a new tenant profile")}</div>
          )}
          {results.map((t) => (
            <button
              type="button"
              key={t.userCode}
              onClick={() => {
                onChange(t);
                setQ("");
                setResults([]);
              }}
              className="block w-full px-3 py-2 text-left text-sm hover:bg-brand-light"
            >
              <span className="font-semibold">{t.name}</span>{" "}
              <span className="text-gray-500">{t.ic}</span>{" "}
              <span className="text-gray-400">· {t.email}</span>
            </button>
          ))}
        </div>
      )}

      {!creating ? (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="mt-1.5 text-xs font-semibold text-brand underline hover:text-brand-dark"
        >
          {t("找不到？点击这里，创建新租客资料。", "Can't find them? Click here to create a new tenant profile.")}
        </button>
      ) : (
        <div className="mt-2 space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <div className="flex flex-wrap gap-2">
            <input
              className="input flex-1"
              placeholder={t("租客姓名", "Tenant Name")}
              value={newTenant.name}
              onChange={(e) => setNewTenant((f) => ({ ...f, name: e.target.value }))}
            />
            <input
              className="input flex-1"
              placeholder="IC"
              value={newTenant.ic}
              onChange={(e) => setNewTenant((f) => ({ ...f, ic: e.target.value }))}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              className="input flex-1"
              placeholder="Email"
              type="email"
              value={newTenant.email}
              onChange={(e) => setNewTenant((f) => ({ ...f, email: e.target.value }))}
            />
            <input
              className="input flex-1"
              placeholder={t("电话 (可不填)", "Phone (optional)")}
              value={newTenant.phone}
              onChange={(e) => setNewTenant((f) => ({ ...f, phone: e.target.value }))}
            />
          </div>
          <div className="flex items-center justify-between">
            <button type="button" onClick={() => setCreating(false)} className="text-xs text-gray-500 hover:underline">
              {t("取消", "Cancel")}
            </button>
            <button type="button" onClick={submitNewTenant} disabled={saving} className="btn-soft text-xs">
              {saving ? t("建立中...", "Creating...") : t("建立租客资料并选用", "Create Tenant Profile & Select")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
