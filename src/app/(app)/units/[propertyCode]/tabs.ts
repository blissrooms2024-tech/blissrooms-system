/** The pages inside one unit (楼盘). Boss and Admin see all eight; Agents see the ones about
 * rooms and tenancies (no money, meters, unit secrets or repairs). */
export const HUB_TABS = [
  { key: "overview", zh: "概况", en: "Overview", agent: true },
  { key: "rooms", zh: "房间", en: "Rooms", agent: true },
  { key: "contracts", zh: "合同", en: "Contracts", agent: true },
  { key: "bills", zh: "账单", en: "Bills", agent: false },
  { key: "utilities", zh: "水电", en: "Utilities", agent: false },
  { key: "repairs", zh: "维修", en: "Repairs", agent: false },
  { key: "info", zh: "资料", en: "Info", agent: false },
  { key: "report", zh: "报表", en: "Report", agent: true },
] as const;

export type HubTab = (typeof HUB_TABS)[number]["key"];

export const tabsFor = (role: string) => HUB_TABS.filter((t) => role === "BOSS" || role === "ADMIN" || t.agent);
