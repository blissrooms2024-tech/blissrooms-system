"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ROLE_LABELS, userStatusLabel } from "@/lib/config";
import { useToast } from "@/components/Toast";
import ConfirmDialog from "@/components/ConfirmDialog";
import EditUserModal, { EditableUser } from "./EditUserModal";
import { useLanguage } from "@/components/LanguageProvider";

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
  const { locale, t } = useLanguage();
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<EditableUser | null>(null);
  const [deleting, setDeleting] = useState<UserRow | null>(null);
  const [q, setQ] = useState("");

  async function load() {
    setError("");
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      if (!data.success) return setError(data.message);
      setUsers(data.users);
    } catch {
      setError(t("出错，请稍后再试", "Error — please try again later"));
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
      toast.success(t("✅ 已批准，Agent 现在可以登入了", "✅ Approved — the Agent can now log in"));
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
      toast.success(
        nextStatus === "DISABLED" ? t("🚫 账号已停用", "🚫 Account disabled") : t("✅ 账号已启用", "✅ Account enabled")
      );
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

  const keyword = q.trim().toLowerCase();
  const filtered =
    users && keyword
      ? users.filter(
          (u) =>
            u.name.toLowerCase().includes(keyword) ||
            u.email.toLowerCase().includes(keyword) ||
            u.userCode.toLowerCase().includes(keyword) ||
            (u.phone ?? "").toLowerCase().includes(keyword)
        )
      : users;

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white p-5 shadow-sm">
        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-brand">
            👥 {t("用户清单", "User List")}
            {users && ` (${filtered!.length}/${users.length})`}
          </h3>
          <div className="flex items-center gap-2">
            <input
              className="input w-[220px] text-sm"
              placeholder={t("搜索姓名 / Email / 电话 / ID...", "Search name / Email / phone / ID...")}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <Link href="/users/new" className="btn-primary text-sm">
              ➕ {t("加新用户", "Add User")}
            </Link>
          </div>
        </div>
        {error && <div className="text-sm text-red-600">{error}</div>}
        {!users && !error && <div className="text-sm text-gray-500">{t("载入中...", "Loading...")}</div>}
        {users && filtered!.length === 0 && (
          <div className="py-8 text-center text-sm text-gray-400">{t("没有符合的用户", "No matching users")}</div>
        )}
        {users && filtered!.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-gray-600">
                  <Th className="hidden sm:table-cell">ID</Th>
                  <Th className="sticky left-0 z-[1] max-w-[140px] bg-gray-50">{t("姓名", "Name")}</Th>
                  <Th>Email</Th>
                  <Th>{t("角色", "Role")}</Th>
                  <Th>{t("电话", "Phone")}</Th>
                  <Th>{t("状态", "Status")}</Th>
                  <Th>{t("验证", "Verified")}</Th>
                  <Th>{t("操作", "Actions")}</Th>
                </tr>
              </thead>
              <tbody>
                {filtered!.map((u) => (
                  <tr key={u.userCode} className="border-b border-gray-100">
                    <Td className="hidden sm:table-cell">{u.userCode}</Td>
                    <Td
                      title={u.name}
                      className="sticky left-0 z-[1] max-w-[140px] truncate bg-white shadow-[2px_0_4px_-2px_rgba(0,0,0,0.15)]"
                    >
                      {u.name}
                    </Td>
                    <Td>{u.email}</Td>
                    <Td>{ROLE_LABELS[u.role] ?? u.role}</Td>
                    <Td>{u.phone || "-"}</Td>
                    <Td>
                      {u.status === "PENDING" ? (
                        <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                          {userStatusLabel(u.status, locale)}
                        </span>
                      ) : (
                        <button
                          onClick={() => toggleStatus(u.userCode, u.status)}
                          title={u.status === "DISABLED" ? t("点一下启用", "Click to enable") : t("点一下停用", "Click to disable")}
                          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            u.status === "DISABLED"
                              ? "bg-gray-100 text-gray-500 hover:bg-gray-200"
                              : "bg-green-50 text-green-700 hover:bg-green-100"
                          }`}
                        >
                          {userStatusLabel(u.status, locale)}
                        </button>
                      )}
                    </Td>
                    <Td>
                      {u.verified ? (
                        <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-green-700">
                          ✅{t("已验证", "Verified")}
                        </span>
                      ) : (
                        <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                          {t("未验证", "Not Verified")}
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
                            ✅{t("批准", "Approve")}
                          </button>
                        )}
                        {!u.verified && (
                          <button onClick={() => sendVerify(u.userCode)} className="btn-soft px-2.5 py-1 text-xs">
                            {t("发送验证", "Send Verification")}
                          </button>
                        )}
                        <button onClick={() => openEdit(u.userCode)} className="btn-primary px-2.5 py-1 text-xs">
                          ✏️{t("编辑", "Edit")}
                        </button>
                        <button
                          onClick={() => setDeleting(u)}
                          className="rounded-lg bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
                        >
                          🗑️{t("删除", "Delete")}
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
        title={`⚠️ ${t("删除用户", "Delete User")}`}
        message={t(
          `确定要删除 ${deleting?.name}（${deleting?.email}）吗？此操作不能撤销。`,
          `Are you sure you want to delete ${deleting?.name} (${deleting?.email})? This action cannot be undone.`
        )}
        confirmLabel={t("确定删除", "Confirm Delete")}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`whitespace-nowrap px-2.5 py-2 font-semibold ${className}`}>{children}</th>;
}
function Td({
  children,
  className = "",
  title,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <td title={title} className={`whitespace-nowrap px-2.5 py-2.5 ${className}`}>
      {children}
    </td>
  );
}
