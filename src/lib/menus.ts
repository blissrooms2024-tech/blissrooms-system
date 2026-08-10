export interface MenuItem {
  href: string;
  label: string;
}

export const MENUS: Record<string, MenuItem[]> = {
  BOSS: [
    { href: "/dashboard", label: "📊 总览" },
    { href: "/rooms", label: "🏠 房间" },
    { href: "/contracts", label: "📄 合同" },
  ],
  ADMIN: [
    { href: "/dashboard", label: "📊 总览" },
    { href: "/rooms", label: "🏠 房间" },
    { href: "/contracts", label: "📄 合同" },
    { href: "/users", label: "👥 用户" },
  ],
  AGENT: [
    { href: "/rooms", label: "🏠 空房" },
    { href: "/contracts", label: "📄 我的合同" },
  ],
  TENANT: [{ href: "/my-tenancy", label: "📄 我的租约" }],
};
