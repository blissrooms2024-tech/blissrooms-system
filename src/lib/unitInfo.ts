/**
 * Field definitions for the unit info page (PropertyInfo), shared by the API (validation,
 * masking) and the UI (forms, labels) so the two can't drift apart.
 */

export type InfoFieldType = "text" | "int" | "date" | "textarea";

export interface InfoField {
  key: string;
  zh: string;
  en: string;
  type: InfoFieldType;
  /** Masked in the UI; only sent to the browser through the logged reveal endpoint. */
  secret?: boolean;
  placeholder?: string;
}

export interface InfoGroup {
  key: string;
  zh: string;
  en: string;
  fields: InfoField[];
}

export const INFO_GROUPS: InfoGroup[] = [
  {
    key: "basic",
    zh: "🏠 基本资料",
    en: "🏠 Basics",
    fields: [
      { key: "unitNo", zh: "座 / 楼层 / 门牌", en: "Block / floor / unit no.", type: "text", placeholder: "B-12-03" },
      { key: "sizeSqft", zh: "面积 (sqft)", en: "Size (sqft)", type: "int" },
      { key: "bathrooms", zh: "厕所数量", en: "Bathrooms", type: "int" },
      { key: "parkingBays", zh: "车位数量", en: "Parking bays", type: "int" },
      { key: "parkingLotNos", zh: "车位号码", en: "Parking bay nos.", type: "text", placeholder: "B2-118, B2-119" },
      { key: "airconCount", zh: "冷气数量", en: "Air-conds", type: "int" },
      { key: "waterHeaterCount", zh: "热水器数量", en: "Water heaters", type: "int" },
      { key: "furnishing", zh: "家具配置", en: "Furnishing", type: "text", placeholder: "Fully / Partially furnished" },
    ],
  },
  {
    key: "access",
    zh: "🔐 密码",
    en: "🔐 Passwords",
    fields: [
      { key: "wifiName", zh: "WiFi 名称", en: "WiFi name", type: "text" },
      { key: "wifiPassword", zh: "WiFi 密码（租客看得到）", en: "WiFi password (tenants can see)", type: "text", secret: true },
      { key: "routerLogin", zh: "路由器管理员登录", en: "Router admin login", type: "text", secret: true },
      { key: "smartLockPassword", zh: "Smart lock 密码", en: "Smart lock password", type: "text", secret: true },
      { key: "mailboxNo", zh: "信箱号码", en: "Mailbox no.", type: "text" },
      { key: "mailboxPassword", zh: "信箱密码", en: "Mailbox password", type: "text", secret: true },
    ],
  },
  {
    key: "building",
    zh: "🏢 管理处 / 大楼",
    en: "🏢 Management office / building",
    fields: [
      { key: "mgmtContactName", zh: "管理处负责人", en: "Management contact", type: "text" },
      { key: "mgmtOfficePhone", zh: "管理处电话", en: "Management office phone", type: "text" },
      { key: "guardhousePhone", zh: "警卫室电话", en: "Guardhouse phone", type: "text" },
      { key: "visitorApp", zh: "访客登记方式", en: "Visitor registration", type: "text", placeholder: "i-Neighbour / Kiplink" },
      { key: "buildingRules", zh: "装修 / 搬家规定", en: "Renovation / moving rules", type: "textarea" },
    ],
  },
  {
    key: "owner",
    zh: "👤 屋主",
    en: "👤 Owner",
    fields: [
      { key: "ownerPhone", zh: "屋主电话", en: "Owner phone", type: "text" },
      { key: "ownerBank", zh: "屋主银行户口", en: "Owner bank account", type: "text", placeholder: "Maybank 1234567890 (Name)" },
      { key: "ownerLeaseStart", zh: "租约开始", en: "Lease start", type: "date" },
      { key: "ownerLeaseEnd", zh: "租约结束", en: "Lease end", type: "date" },
      { key: "ownerRentDueDay", zh: "每月几号付屋主租金", en: "Owner rent due (day of month)", type: "int" },
      { key: "renewalNoticeDays", zh: "续约通知期（天）", en: "Renewal notice (days)", type: "int" },
    ],
  },
  {
    key: "equipment",
    zh: "🔧 设备",
    en: "🔧 Equipment",
    fields: [
      { key: "appliances", zh: "电器清单（购买日期、保修）", en: "Appliances (bought, warranty)", type: "textarea" },
      { key: "airconLastServiced", zh: "冷气上次清洗", en: "Air-cond last serviced", type: "date" },
      { key: "fireExtinguisherExpiry", zh: "灭火器到期", en: "Fire extinguisher expiry", type: "date" },
    ],
  },
];

export const INFO_FIELDS: InfoField[] = INFO_GROUPS.flatMap((g) => g.fields);
export const SECRET_KEYS = INFO_FIELDS.filter((f) => f.secret).map((f) => f.key);

export const CARD_TYPES = ["ACCESS_CARD", "RFID", "REMOTE", "KEY", "MAILBOX_KEY", "OTHER"] as const;
export const CARD_TYPE_LABELS: Record<string, [string, string]> = {
  ACCESS_CARD: ["门卡", "Access card"],
  RFID: ["RFID", "RFID tag"],
  REMOTE: ["车库遥控", "Carpark remote"],
  KEY: ["钥匙", "Key"],
  MAILBOX_KEY: ["信箱钥匙", "Mailbox key"],
  OTHER: ["其他", "Other"],
};
export const CARD_HOLDERS = ["ROOM", "OFFICE", "OWNER", "OTHER"] as const;
export const CARD_HOLDER_LABELS: Record<string, [string, string]> = {
  ROOM: ["房间租客", "Room tenant"],
  OFFICE: ["办公室", "Office"],
  OWNER: ["屋主", "Owner"],
  OTHER: ["其他", "Other"],
};
export const CARD_STATUSES = ["IN_USE", "SPARE", "LOST"] as const;
export const CARD_STATUS_LABELS: Record<string, [string, string]> = {
  IN_USE: ["使用中", "In use"],
  SPARE: ["备用", "Spare"],
  LOST: ["遗失", "Lost"],
};

export const UTILITY_TYPES = ["ELECTRIC", "WATER", "SEWERAGE", "WIFI", "GAS", "OTHER"] as const;
export const UTILITY_TYPE_LABELS: Record<string, [string, string]> = {
  ELECTRIC: ["⚡ 电费", "⚡ Electricity"],
  WATER: ["💧 水费", "💧 Water"],
  SEWERAGE: ["🚽 排污 (IWK)", "🚽 Sewerage (IWK)"],
  WIFI: ["📶 WiFi", "📶 WiFi"],
  GAS: ["🔥 煤气", "🔥 Gas"],
  OTHER: ["📄 其他", "📄 Other"],
};
export const PAY_TO = ["GOVERNMENT", "MANAGEMENT", "PROVIDER", "OWNER"] as const;
export const PAY_TO_LABELS: Record<string, [string, string]> = {
  GOVERNMENT: ["付给政府", "Government"],
  MANAGEMENT: ["付给管理处", "Management"],
  PROVIDER: ["付给供应商", "Provider"],
  OWNER: ["付给屋主", "Owner"],
};

export function label(map: Record<string, [string, string]>, key: string, locale: "zh" | "en"): string {
  const v = map[key];
  if (!v) return key;
  return locale === "en" ? v[1] : v[0];
}

/** Next calendar date (YYYY-MM-DD) for a day-of-month due date, clamped to short months. */
export function nextDueDate(dueDay: number, from = new Date()): string {
  const y = from.getFullYear();
  const m = from.getMonth();
  const clamp = (yy: number, mm: number) => Math.min(dueDay, new Date(yy, mm + 1, 0).getDate());
  let d = new Date(y, m, clamp(y, m));
  const today = new Date(y, m, from.getDate());
  if (d < today) d = new Date(y, m + 1, clamp(y, m + 1));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
