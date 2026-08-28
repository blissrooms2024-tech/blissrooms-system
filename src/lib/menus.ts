export interface MenuItem {
  href: string;
  label: string;
}

export const MENUS: Record<string, MenuItem[]> = {
  BOSS: [
    { href: "/dashboard", label: "📊 总览" },
    { href: "/units", label: "🏢 楼盘" },
    { href: "/rooms", label: "🏠 房间" },
    { href: "/contracts", label: "📄 合同" },
    { href: "/payments/review", label: "🧾 水单审核" },
    { href: "/maintenance", label: "🔧 报修" },
  ],
  ADMIN: [
    { href: "/dashboard", label: "📊 总览" },
    { href: "/units", label: "🏢 楼盘" },
    { href: "/rooms", label: "🏠 房间" },
    { href: "/contracts", label: "📄 合同" },
    { href: "/payments/review", label: "🧾 水单审核" },
    { href: "/payments/bulk", label: "📢 批量开账单" },
    { href: "/maintenance", label: "🔧 报修" },
    { href: "/users", label: "👥 用户" },
  ],
  AGENT: [
    { href: "/units", label: "🏢 楼盘" },
    { href: "/rooms", label: "🏠 空房" },
    { href: "/contracts", label: "📄 我的合同" },
  ],
  TENANT: [
    { href: "/my-tenancy", label: "📄 我的租约" },
    { href: "/my-bills", label: "💳 我的账单" },
    { href: "/my-aircon", label: "❄️ 冷气充值" },
    { href: "/my-movein", label: "📋 Move-in" },
    { href: "/my-moveout", label: "📦 Move-out" },
    { href: "/my-maintenance", label: "🔧 报修" },
  ],
  WORKER: [
    { href: "/worker", label: "🔧 我的报修任务" },
    { href: "/worker/payslip", label: "💰 我的薪水单" },
  ],
};
