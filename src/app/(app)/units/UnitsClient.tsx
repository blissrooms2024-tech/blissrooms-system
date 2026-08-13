"use client";

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { useToast } from "@/components/Toast";

interface PropertyRow {
  propertyCode: string;
  name: string;
  address: string | null;
  region: string | null;
  landlord: string | null;
  managementFeeRate: number | null;
  status: string | null;
  roomCount: number;
}

const emptyForm = { name: "", address: "", region: "", landlord: "", managementFeeRate: "", notes: "" };

export default function UnitsClient({ role }: { role: string }) {
  const toast = useToast();
  const [properties, setProperties] = useState<PropertyRow[] | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyForm);
  const canEdit = role === "ADMIN";

  async function load() {
    setError("");
    try {
      const res = await fetch("/api/properties");
      const data = await res.json();
      if (!data.success) {
        setError(data.message);
        return;
      }
      setProperties(data.properties);
    } catch {
      setError("出错，请稍后再试");
    }
  }

  useEffect(() => {
    // setState happens after the fetch's await, not synchronously in the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  async function addProperty(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.warning("楼盘名字一定要填");
      return;
    }
    const res = await fetch("/api/properties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        managementFeeRate: form.managementFeeRate ? Number(form.managementFeeRate) / 100 : undefined,
      }),
    });
    const data = await res.json();
    if (data.success) {
      toast.success(data.message);
      setForm(emptyForm);
      load();
    } else {
      toast.danger(data.message);
    }
  }

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <h3 className="mb-3.5 text-base font-semibold text-brand">➕ 加新楼盘 (Unit)</h3>
          <form onSubmit={addProperty} className="flex flex-wrap items-end gap-2.5">
            <Field label="楼盘名字">
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="地址">
              <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </Field>
            <Field label="地区">
              <input className="input" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} />
            </Field>
            <Field label="Landlord (帮人管理才填)">
              <input
                className="input"
                value={form.landlord}
                onChange={(e) => setForm({ ...form, landlord: e.target.value })}
                placeholder="留空 = 自己名下"
              />
            </Field>
            <Field label="管理费 % (例10)">
              <input
                type="number"
                step="0.1"
                className="input"
                value={form.managementFeeRate}
                onChange={(e) => setForm({ ...form, managementFeeRate: e.target.value })}
              />
            </Field>
            <button type="submit" className="btn-primary">
              建立
            </button>
          </form>
        </div>
      )}

      <div className="rounded-xl bg-white p-5 shadow-sm">
        <h3 className="mb-3.5 text-base font-semibold text-brand">🏢 楼盘清单</h3>
        {error && <div className="text-sm text-red-600">{error}</div>}
        {!properties && !error && <div className="text-sm text-gray-500">载入中...</div>}
        {properties && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-gray-600">
                  <Th>楼盘号</Th>
                  <Th>名字</Th>
                  <Th>房间数</Th>
                  <Th>Landlord</Th>
                  <Th>管理费</Th>
                  <Th>操作</Th>
                </tr>
              </thead>
              <tbody>
                {properties.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-gray-400">
                      还没有楼盘
                    </td>
                  </tr>
                )}
                {properties.map((p) => (
                  <tr key={p.propertyCode} className="border-b border-gray-100">
                    <Td>
                      <b>{p.propertyCode}</b>
                    </Td>
                    <Td>{p.name}</Td>
                    <Td>{p.roomCount}</Td>
                    <Td>
                      {p.landlord ? (
                        <span className="rounded-full bg-brand-light px-2.5 py-0.5 text-xs font-semibold text-brand">
                          {p.landlord}
                        </span>
                      ) : (
                        <span className="text-gray-400">自己名下</span>
                      )}
                    </Td>
                    <Td>{p.landlord && p.managementFeeRate ? `${(p.managementFeeRate * 100).toFixed(1)}%` : "-"}</Td>
                    <Td>
                      <Link href={`/units/${p.propertyCode}`} className="btn-soft px-2.5 py-1 text-xs">
                        📊 月报
                      </Link>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-[150px] flex-1">
      <label className="mb-1.5 block text-sm text-gray-600">{label}</label>
      {children}
    </div>
  );
}
function Th({ children }: { children: React.ReactNode }) {
  return <th className="whitespace-nowrap px-2.5 py-2 font-semibold">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="whitespace-nowrap px-2.5 py-2.5">{children}</td>;
}
