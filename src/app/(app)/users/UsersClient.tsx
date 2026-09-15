"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ROLE_LABELS, USER_STATUS_LABELS } from "@/lib/config";
import { useToast } from "@/components/Toast";
import ConfirmDialog from "@/components/ConfirmDialog";
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

export default function UsersClient() {
  const toast = useToast();
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<EditableUser | null>(null);
  const [deleting, setDeleting] = useState<UserRow | null>(null);

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

  async function sendVerify(userCode: string) {
    const res = await fetch(`/api/users/${userCode}/send-verify`, { method: "POST" });
    const data = await res.json();
    if (data.success) {
      toast.success(data.message);
      load();
    } else {
      toast.danger(data.message);
    }
  }

  async function approve(userCode: string) {
    const res = await fetch(`/api/users/${userCode}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "ACTIVE" }),
    });
    const data = await res.json();
    if (data.success) {
      toast.success("✅ 已批准，Agent 现在可以登入了");
      load();
    } else {
      toast.danger(data.message);
    }
  }

  async function toggleStatus(userCode: string, currentStatus: string) {
    const nextStatus = currentStatus === "DISABLED" ? "ACTIVE" : "DISABLED";
    const res = await fetch(`/api/users/${userCode}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    const data = await res.json();
    if (data.success) {
      toast.success(nextStatus === "DISABLED" ? "🚫 账号已停用" : "✅ 账号已启用");
      load();
    } else {
      toast.danger(data.message);
    }
  }

  async function openEdit(userCode: string) {
    const res = await fetch(`/api/users/${userCode}`);
    const data = await res.json();
    if (data.success) setEditing(data.user);
  }

  async function confirmDelete() {
    if (!deleting) return;
    const res = await fetch(`/api/users/${deleting.userCode}`, { method: "DELETE" });
    const data = await res.json();
    if (data.success) {
      toast.success(data.message);
      load();
    } else {
      toast.danger(data.message);
    }
    setDeleting(null);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white p-5 shadow-sm">
        <div className="mb-3.5 flex items-center justify-between">
          <h3 className="text-base font-semibold text-brand">👥 用户清单</h3>
          <Link href="/users/new" className="btn-primary text-sm">
            ➕ 加新用户
          </Link>
        </div>
        {error && <div className="text-sm text-red-600">{error}</div>}
        {!users && !error && <div className="text-sm text-gray-500">载入中...</div>}
        {users && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-gray-600">
                  <Th className="hidden sm:table-cell">ID</Th>
                  <Th className="sticky left-0 z-[1] bg-gray-50">姓名</Th>
                  <Th>Email</Th>
                  <Th>角色</Th>
                  <Th>电话</Th>
                  <Th>状态</Th>
                  <Th>验证</Th>
                  <Th>操作</Th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.userCode} className="border-b border-gray-100">
                    <Td className="hidden sm:table-cell">{u.userCode}</Td>
                    <Td className="sticky left-0 z-[1] bg-white shadow-[2px_0_4px_-2px_rgba(0,0,0,0.15)]">{u.name}</Td>
                    <Td>{u.email}</Td>
                    <Td>{ROLE_LABELS[u.role] ?? u.role}</Td>
                    <Td>{u.phone || "-"}</Td>
                    <Td>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          u.status === "PENDING"
                            ? "bg-amber-50 text-amber-700"
                            : u.status === "DISABLED"
                              ? "bg-gray-100 text-gray-500"
                              : "bg-green-50 text-green-700"
                        }`}
                      >
                        {USER_STATUS_LABELS[u.status] ?? u.status}
                      </span>
                    </Td>
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
                        {u.status === "PENDING" && (
                          <button
                            onClick={() => approve(u.userCode)}
                            className="rounded-lg bg-green-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-green-700"
                          >
                            ✅批准
                          </button>
                        )}
                        {!u.verified && (
                          <button onClick={() => sendVerify(u.userCode)} className="btn-soft px-2.5 py-1 text-xs">
                            发送验证
                          </button>
                        )}
                        {u.status !== "PENDING" && (
                          <button
                            onClick={() => toggleStatus(u.userCode, u.status)}
                            className={
                              u.status === "DISABLED"
                                ? "rounded-lg bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700 hover:bg-green-100"
                                : "rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-200"
                            }
                          >
                            {u.status === "DISABLED" ? "✅启用" : "🚫停用"}
                          </button>
                        )}
                        <button onClick={() => openEdit(u.userCode)} className="btn-primary px-2.5 py-1 text-xs">
                          ✏️编辑
                        </button>
                        <button
                          onClick={() => setDeleting(u)}
                          className="rounded-lg bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
                        >
                          🗑️删除
                        </button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && <EditUserModal user={editing} onClose={() => setEditing(null)} onSaved={load} />}

      <ConfirmDialog
        open={!!deleting}
        danger
        title="⚠️ 删除用户"
        message={`确定要删除 ${deleting?.name}（${deleting?.email}）吗？此操作不能撤销。`}
        confirmLabel="确定删除"
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`whitespace-nowrap px-2.5 py-2 font-semibold ${className}`}>{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`whitespace-nowrap px-2.5 py-2.5 ${className}`}>{children}</td>;
}
