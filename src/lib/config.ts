/**
 * Global config constants — ported from the original Apps Script Config.gs.
 * Keep these in sync with prisma/schema.prisma enums where relevant.
 */

export const FEES = {
  LATE_PER_DAY: 30, // 迟交 RM30/天
  RENEWAL: 200, // 续约 RM200
  TRANSFER: 200, // 转房 RM200
  LOST_KEY: 150, // 丢钥匙 RM150
  LOST_ACCESS_CARD: 200, // 丢门卡 RM200
  LOCKOUT_DAY: 80, // 锁门外 日 RM80
  LOCKOUT_NIGHT: 120, // 锁门外 夜 RM120
  CLEANING: 50, // 没清理 RM50
  AC_PER_KWH: 0.75, // 冷气 RM0.75/kWh
  DRYER_PER_KWH: 0.5, // 烘干机 RM0.50/kWh
  ELECTRIC_PER_KWH: 0.5, // 电费 RM0.50/kWh
} as const;

// Rent-arrears escalation policy: days a RENTAL bill has been overdue (past its dueDate)
// before each step fires — see src/app/api/cron/late-fees/route.ts.
export const RENT_ARREARS = {
  WARNING_LETTER_DAYS: 2, // day 7 if due on the 5th: auto warning letter to tenant
  ESCALATION_DAYS: 5, // day 10 if due on the 5th: Admin gets told to consider termination
} as const;

export const RULES = {
  RENT_DUE_DAY: 25, // 每月25号前交租
  RENT_GRACE_DAY: 5, // 最迟实际月份5号
  DRAFT_AUTO_DELETE_DAYS: 3, // 草稿3天没搞好自动删
  NOTICE_MONTHS: 2, // 到期前2个月通知
  DEPOSIT_REFUND_DAYS: 30, // 押金30工作天内退
  DEFAULT_COMM_RATE: 0.5, // Agent默认佣金率
  MOVE_OUT_WINDOW_DAYS: 14, // 到期前14天才开放 Move-out
} as const;

export const COMPANY = {
  NAME: "BLISS ROOMS ENTERPRISE",
  REG_NO: "202403031665 (003573307-U)",
  ADDRESS: "No. 5635, Lahar Tiang, 13200 Kepala Batas, Pulau Pinang",
  TEL: "011-3654 7863 / 012-439 2491",
  EMAIL: "blissrooms2024@gmail.com",
  BANK: "HONG LEONG BANK",
  ACC_NO: "15801018612",
} as const;

export const ROLE_LABELS: Record<string, string> = {
  BOSS: "老板 Boss",
  ADMIN: "Admin",
  AGENT: "Agent",
  TENANT: "租客 Tenant",
  WORKER: "维修工人 Worker",
};

export const ROOM_STATUS_LABELS: Record<string, string> = {
  VACANT: "空房",
  OCCUPIED: "已出租",
  RESERVED: "已订",
  MAINTENANCE: "维修中",
};

export const CONTRACT_STATUS_LABELS: Record<string, string> = {
  DRAFT: "草稿",
  PENDING_APPROVE: "等批",
  PENDING_SIGN: "等签名",
  ACTIVE: "生效中",
  EXPIRING: "快到期",
  EXPIRED: "已到期",
  TERMINATED: "已终止",
  MOVED_OUT: "已搬出",
};

/** Appendix images (logo + 10 house-rule notice photos), bundled as static assets in
 * public/contract-images/. Override via env if you ever want to swap them out without a redeploy. */
const DEFAULT_NOTICE_URLS = [
  "/contract-images/notice-01-general-house-rules.jpg",
  "/contract-images/notice-02-common-area-cleanliness.jpg",
  "/contract-images/notice-03-entrance-cleanliness.jpg",
  "/contract-images/notice-04-kitchen-area-cleanliness.jpg",
  "/contract-images/notice-05-toilet-rules.jpg",
  "/contract-images/notice-06-laundry-house-rules.jpg",
  "/contract-images/notice-07-router-troubleshooting.jpg",
  "/contract-images/notice-08-electrical-power-trip.jpg",
  "/contract-images/notice-09-appliances-aircond-furniture.jpg",
  "/contract-images/notice-10-lost-key-smart-door.jpg",
];

export const CONTRACT_IMAGES = {
  logo: process.env.NEXT_PUBLIC_CONTRACT_LOGO_URL || "/contract-images/logo.png",
  notices: process.env.NEXT_PUBLIC_CONTRACT_NOTICE_URLS
    ? process.env.NEXT_PUBLIC_CONTRACT_NOTICE_URLS.split(",").map((s) => s.trim())
    : DEFAULT_NOTICE_URLS,
};

export const PAYMENT_TYPE_LABELS: Record<string, string> = {
  DEPOSIT: "押金",
  UTILITIES: "水电押",
  RENTAL: "房租",
  ADMIN_FEE: "Admin Fee",
  ACCESS_CARD: "门卡押",
  CARPARK: "车位租金",
  AC: "冷气",
  DRYER: "烘干机",
  ELECTRIC: "电费",
  LATE_FEE: "迟交罚款",
  OTHER: "其他",
};

/** Shows Admin's own custom name for a type=OTHER charge (e.g. "清洁费") instead of the
 * generic "其他" label, since those are ad-hoc bill types Admin creates on the fly. */
export function paymentTypeLabel(type: string, customLabel?: string | null): string {
  if (type === "OTHER" && customLabel) return customLabel;
  return PAYMENT_TYPE_LABELS[type] ?? type;
}

export const MAINTENANCE_STATUS_LABELS: Record<string, string> = {
  SUBMITTED: "已提交",
  ACKNOWLEDGED: "已受理",
  IN_PROGRESS: "处理中",
  PENDING_REVIEW: "待审核",
  COMPLETED: "已完成",
  CANCELLED: "已取消",
};
