/**
 * What furniture a room has. Management sets it once the room is done up (every room starts
 * with the six basics, and any of the add-ons below can be ticked or typed in); the tenant then
 * only ticks whether each item is there at move-in. Kept free of imports so it can be unit-tested.
 */

export interface FurnitureDef {
  key: string;
  zh: string;
  en: string;
  /** One of the six every room has: ticked from the start. */
  basic?: boolean;
  /** Must pick one, e.g. a fan works by remote or by a wall regulator. */
  variants?: { key: string; zh: string; en: string }[];
  /** Ask how many (curtains). */
  qty?: boolean;
}

export const FURNITURE: FurnitureDef[] = [
  { key: "mattress", zh: "床垫", en: "Mattress", basic: true },
  { key: "bedframe", zh: "床架 / Divan", en: "Bedframe / divan", basic: true },
  { key: "wardrobe", zh: "衣橱", en: "Wardrobe", basic: true },
  { key: "studyTable", zh: "书桌", en: "Study table", basic: true },
  { key: "chair", zh: "椅子", en: "Chair", basic: true },
  {
    key: "fan",
    zh: "风扇",
    en: "Fan",
    basic: true,
    variants: [
      { key: "remote", zh: "遥控", en: "remote" },
      { key: "regulator", zh: "Regulator", en: "regulator" },
    ],
  },
  { key: "mattressCover", zh: "床垫套", en: "Mattress cover" },
  { key: "sideTable", zh: "床头柜", en: "Side table" },
  { key: "dressingTable", zh: "梳妆台", en: "Dressing table" },
  { key: "curtain", zh: "窗帘", en: "Curtain", qty: true },
  { key: "rubbishBin", zh: "垃圾桶", en: "Rubbish bin" },
  { key: "aircond", zh: "冷气", en: "Aircond" },
  { key: "aircondRemote", zh: "冷气遥控", en: "Aircond remote" },
  { key: "waterHeater", zh: "热水器", en: "Water heater" },
  { key: "fridge", zh: "冰箱", en: "Fridge" },
  { key: "waterDispenser", zh: "饮水机", en: "Water dispenser" },
  { key: "inductionCooker", zh: "电磁炉", en: "Induction cooker" },
  { key: "kitchenCabinet", zh: "厨柜", en: "Kitchen cabinet" },
];

const DEF = new Map(FURNITURE.map((d) => [d.key, d]));

/** One thing in a room. Typed-in extras have key "custom" and their own label. */
export interface FurnitureItem {
  key: string;
  qty?: number;
  variant?: string;
  label?: string;
}

/** What a new room's list starts as: the six basics. */
export const BASIC_FURNITURE: FurnitureItem[] = FURNITURE.filter((d) => d.basic).map((d) => ({ key: d.key }));

export const MAX_FURNITURE = 40;

/**
 * Check a list sent by the form. Returns the tidy list, or a message saying what's wrong
 * (in Chinese, like the rest of the API's messages).
 */
export function cleanFurniture(raw: unknown): { items: FurnitureItem[] } | { error: string } {
  if (!Array.isArray(raw)) return { error: "家具清单格式不对" };
  if (raw.length > MAX_FURNITURE) return { error: `最多 ${MAX_FURNITURE} 样` };
  const items: FurnitureItem[] = [];
  const seen = new Set<string>();
  for (const r of raw) {
    if (!r || typeof r !== "object") return { error: "家具清单格式不对" };
    const { key, qty, variant, label } = r as Record<string, unknown>;
    if (key === "custom") {
      const name = typeof label === "string" ? label.replace(/\s+/g, " ").trim().slice(0, 40) : "";
      if (!name) return { error: "自己写的家具要有名字" };
      const id = `custom:${name.toLowerCase()}`;
      if (seen.has(id)) continue;
      seen.add(id);
      const n = typeof qty === "number" && Number.isInteger(qty) && qty > 1 && qty <= 20 ? qty : undefined;
      items.push(n ? { key: "custom", label: name, qty: n } : { key: "custom", label: name });
      continue;
    }
    const def = typeof key === "string" ? DEF.get(key) : undefined;
    if (!def) return { error: "有一样家具不认识" };
    if (seen.has(def.key)) continue;
    seen.add(def.key);
    const item: FurnitureItem = { key: def.key };
    if (def.variants) {
      if (typeof variant !== "string" || !def.variants.some((v) => v.key === variant)) {
        return { error: `${def.zh}要选${def.variants.map((v) => v.zh).join("还是")}` };
      }
      item.variant = variant;
    }
    if (def.qty && typeof qty === "number" && Number.isInteger(qty) && qty > 1 && qty <= 20) item.qty = qty;
    items.push(item);
  }
  return { items };
}

/** "风扇（遥控）", "窗帘 ×2", or the typed-in name. */
export function furnitureLabel(item: FurnitureItem, locale: "zh" | "en"): string {
  const def = DEF.get(item.key);
  const base = item.key === "custom" ? (item.label ?? "") : def ? (locale === "en" ? def.en : def.zh) : item.key;
  const v = def?.variants?.find((x) => x.key === item.variant);
  const variant = v ? (locale === "en" ? ` (${v.en})` : `（${v.zh}）`) : "";
  return `${base}${variant}${item.qty && item.qty > 1 ? ` ×${item.qty}` : ""}`;
}

/** A stored list read back from the database (anything odd is dropped, not thrown). */
export function readFurniture(json: unknown): FurnitureItem[] | null {
  if (json == null) return null;
  if (!Array.isArray(json)) return [];
  // Item by item, so one entry the catalog no longer knows doesn't hide the rest.
  return json.flatMap((r) => {
    const one = cleanFurniture([r]);
    return "items" in one ? one.items : [];
  });
}
