export interface MenuItem {
  href: string;
  label: string;
  labelEn: string;
}

export const MENUS: Record<string, MenuItem[]> = {
  BOSS: [
    { href: "/dashboard", label: "📊 总览", labelEn: "📊 Overview" },
    { href: "/finance", label: "💰 财务总览", labelEn: "💰 Finance Overview" },
    { href: "/units", label: "🏢 楼盘", labelEn: "🏢 Properties" },
    { href: "/rooms", label: "🏠 房间", labelEn: "🏠 Rooms" },
    { href: "/contracts", label: "📄 合同", labelEn: "📄 Contracts" },
    { href: "/payments/review", label: "🧾 交易单审核", labelEn: "🧾 Payment Review" },
    { href: "/payments/outstanding", label: "📋 未清账单", labelEn: "📋 Outstanding Bills" },
    { href: "/warning-letters", label: "⚠️ 警告信记录", labelEn: "⚠️ Warning Letters" },
    { href: "/maintenance", label: "🔧 报修", labelEn: "🔧 Maintenance" },
  ],
  ADMIN: [
    { href: "/dashboard", label: "📊 总览", labelEn: "📊 Overview" },
    { href: "/finance", label: "💰 财务总览", labelEn: "💰 Finance Overview" },
    { href: "/units", label: "🏢 楼盘", labelEn: "🏢 Properties" },
    { href: "/rooms", label: "🏠 房间", labelEn: "🏠 Rooms" },
    { href: "/contracts", label: "📄 合同", labelEn: "📄 Contracts" },
    { href: "/payments/review", label: "🧾 交易单审核", labelEn: "🧾 Payment Review" },
    { href: "/payments/outstanding", label: "📋 未清账单", labelEn: "📋 Outstanding Bills" },
    { href: "/payments/bulk", label: "📢 批量开账单", labelEn: "📢 Bulk Billing" },
    { href: "/warning-letters", label: "⚠️ 警告信记录", labelEn: "⚠️ Warning Letters" },
    { href: "/maintenance", label: "🔧 报修", labelEn: "🔧 Maintenance" },
    { href: "/users", label: "👥 用户", labelEn: "👥 Users" },
  ],
  AGENT: [
    { href: "/agent-dashboard", label: "📊 我的总览", labelEn: "📊 My Overview" },
    { href: "/agent-tenants", label: "📋 Tenant 进度", labelEn: "📋 Tenant Progress" },
    { href: "/agent-commission", label: "💰 我的佣金", labelEn: "💰 My Commission" },
    { href: "/agent-payslip", label: "📑 我的 Payslip", labelEn: "📑 My Payslip" },
    { href: "/rooms", label: "🏠 空房", labelEn: "🏠 Vacant Rooms" },
    { href: "/contracts", label: "📄 我的合同", labelEn: "📄 My Contracts" },
  ],
  TENANT: [
    { href: "/my-tenancy", label: "📄 我的租约", labelEn: "📄 My Tenancy" },
    { href: "/my-warnings", label: "⚠️ 警告信", labelEn: "⚠️ Warning Letters" },
    { href: "/my-bills", label: "💳 我的账单", labelEn: "💳 My Bills" },
    { href: "/my-aircon", label: "❄️ 冷气充值", labelEn: "❄️ Air-Cond Top-Up" },
    { href: "/my-movein", label: "📋 Move-in", labelEn: "📋 Move-in" },
    { href: "/my-moveout", label: "📦 Move-out", labelEn: "📦 Move-out" },
    { href: "/my-maintenance", label: "🔧 报修", labelEn: "🔧 Maintenance" },
  ],
  WORKER: [
    { href: "/worker", label: "🔧 我的报修任务", labelEn: "🔧 My Maintenance Jobs" },
    { href: "/worker/payslip", label: "💰 我的薪水单", labelEn: "💰 My Payslip" },
  ],
};
