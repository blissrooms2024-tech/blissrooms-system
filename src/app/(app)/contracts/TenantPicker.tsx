"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/Toast";

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
}: {
  value: TenantOption | null;
  onChange: (tenant: TenantOption | null) => void;
}) {
  const toast = useToast();
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
      toast.warning("姓名/IC/Email 一定要填");
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
      toast.danger("系统出错，请稍后再试");
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
          换一个
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        className="input"
        placeholder="输入 IC / 姓名 / Email 搜索租客"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {q.trim() && (
        <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
          {searching && <div className="px-3 py-2 text-sm text-gray-400">搜索中...</div>}
          {!searching && results.length === 0 && (
            <div className="px-3 py-2 text-sm text-gray-400">没找到，可以新建租客资料</div>
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
          + 找不到？新建租客资料
        </button>
      ) : (
        <div className="mt-2 space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <div className="flex flex-wrap gap-2">
            <input
              className="input flex-1"
              placeholder="租客姓名"
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
              placeholder="电话 (可不填)"
              value={newTenant.phone}
              onChange={(e) => setNewTenant((f) => ({ ...f, phone: e.target.value }))}
            />
          </div>
          <div className="flex items-center justify-between">
            <button type="button" onClick={() => setCreating(false)} className="text-xs text-gray-500 hover:underline">
              取消
            </button>
            <button type="button" onClick={submitNewTenant} disabled={saving} className="btn-soft text-xs">
              {saving ? "建立中..." : "建立租客资料并选用"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
