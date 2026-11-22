/** The 2 built-in voucher card designs Admin picks from at issue time (a live preview, not a
 * file upload) — shared between the issue form's preview and the tenant's actual card so they
 * always match exactly. */
export const VOUCHER_TEMPLATES = {
  blue: { gradient: "from-sky-500 to-indigo-600", labelZh: "蓝色", labelEn: "Blue" },
  pink: { gradient: "from-pink-500 to-rose-500", labelZh: "粉红色", labelEn: "Pink" },
} as const;

export type VoucherTemplate = keyof typeof VOUCHER_TEMPLATES;

export function voucherGradient(template: string): string {
  return VOUCHER_TEMPLATES[template as VoucherTemplate]?.gradient ?? VOUCHER_TEMPLATES.blue.gradient;
}
