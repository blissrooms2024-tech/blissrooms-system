"use client";

import { useEffect, useState, FormEvent } from "react";
import { ROLE_LABELS } from "@/lib/config";
import EditUserModal, { EditableUser } from "./EditUserModal";

interface UserRow {
  userCode: string;
  name: string;
  email: string;
  role: string;
  phone: string | null;
  status: string;
  verified: boolean;
}

const emptyForm = { name: "", email: "", role: "AGENT", phone: "", ic: "", password: "1234", commRate: "0.5" };

export default function UsersClient() {
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [addMsg, setAddMsg] = useState("");
  const [editing, setEditing] = useState<EditableUser | null>(null);
  const [verifyMsg, setVerifyMsg] = useState<Record<string, string>>({});

  async function load() {
    setError("");
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      if (!data.success) return setError(data.message);
      setUsers(data.users);
    } catch {
      setError("出错，请稍后再试");
    }
  }

  useEffect(() => {
    // setState happens after the fetch's await, not synchronously in the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  async function addUser(e: FormEvent) {
    e.preventDefault();
    if (!form.name || !form.email) {
      setAddMsg("姓名和 Email 一定要填");
      return;
    }
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setAddMsg(data.message);
    if (data.success) {
      setForm(emptyForm);
      load();
    }
  }

  async function sendVerify(userCode: string) {
    const res = await fetch(`/api/users/${userCode}/send-verify`, { method: "POST" });
    const data = await res.json();
    setVerifyMsg({ ...verifyMsg, [userCode]: data.message });
    if (data.success) load();
  }

  async function openEdit(userCode: string) {
    const res = await fetch(`/api/users/${userCode}`);
    const data = await res.json();
    if (data.success) setEditing(data.user);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white p-5 shadow-sm">
        <h3 className="mb-3.5 text-base font-semibold text-brand">➕ 加新用户</h3>
        <form onSubmit={addUser} className="flex flex-wrap items-end gap-2.5">
          <Field label="姓名">
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Email">
            <input
              type="email"
              className="input"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </Field>
          <Field label="角色">
            <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {Object.entries(ROLE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="电话">
            <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="IC">
            <input className="input" value={form.ic} onChange={(e) => setForm({ ...form, ic: e.target.value })} />
          </Field>
          <Field label="初始密码">
            <input className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </Field>
          <Field label="佣金率(例0.5)">
            <input
              type="number"
              step="0.01"
              className="input"
              value={form.commRate}
              onChange={(e) => setForm({ ...form, commRate: e.target.value })}
            />
          </Field>
          <button type="submit" className="btn-primary">
            建立
          </button>
        </form>
        {addMsg && <div className="mt-2.5 text-sm text-gray-600">{addMsg}</div>}
      </div>

      <div className="rounded-xl bg-white p-5 shadow-sm">
        <h3 className="mb-3.5 text-base font-semibold text-brand">👥 用户清单</h3>
        {error && <div className="text-sm text-red-600">{error}</div>}
        {!users && !error && <div className="text-sm text-gray-500">载入中...</div>}
        {users && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-gray-600">
                  <Th>ID</Th>
                  <Th>姓名</Th>
                  <Th>Email</Th>
                  <Th>角色</Th>
                  <Th>电话</Th>
                  <Th>验证</Th>
                  <Th>操作</Th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.userCode} className="border-b border-gray-100">
                    <Td>{u.userCode}</Td>
                    <Td>{u.name}</Td>
                    <Td>{u.email}</Td>
                    <Td>{ROLE_LABELS[u.role] ?? u.role}</Td>
                    <Td>{u.phone || "-"}</Td>
                    <Td>
                      {u.verified ? (
                        <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-green-700">
                          ✅已验证
                        </span>
                      ) : (
                        <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                          未验证
                        </span>
                      )}
                    </Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        {!u.verified && (
                          <button onClick={() => sendVerify(u.userCode)} className="btn-soft px-2.5 py-1 text-xs">
                            发送验证
                          </button>
                        )}
                        <button onClick={() => openEdit(u.userCode)} className="btn-primary px-2.5 py-1 text-xs">
                          ✏️编辑
                        </button>
                      </div>
                      {verifyMsg[u.userCode] && (
                        <div className="mt-1 text-xs text-gray-500">{verifyMsg[u.userCode]}</div>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && <EditUserModal user={editing} onClose={() => setEditing(null)} onSaved={load} />}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-[130px] flex-1">
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
