import { createHash } from "crypto";
import { readFile } from "fs/promises";
import path from "path";
import { get } from "@vercel/blob";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";
import { MANUAL_EXPENSE_CATEGORIES } from "@/lib/config";
import { cleanReading, sameReceipt, type Reading, type ReceiptKey, type UnitRef } from "@/lib/receiptMatch";

/**
 * Reads a claim's receipt photos with Claude (amount, date, shop, what was bought, category,
 * account numbers, address) so staff don't have to type them. Needs ANTHROPIC_API_KEY; without
 * it the claim form simply stays a form to fill in.
 */

// Haiku: about RM0.003 a receipt. If handwritten receipts get misread often, set
// RECEIPT_MODEL=claude-sonnet-5-5 in Vercel (about RM0.05 a receipt).
const MODEL = process.env.RECEIPT_MODEL || "claude-haiku-5-5";
const API_URL = `${process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com"}/v1/messages`;
/** Local testing only: a JSON file that stands in for the model's answer. */
const FAKE = process.env.NODE_ENV !== "production" ? process.env.RECEIPT_READER_FAKE : undefined;

export const receiptReaderOn = () => !!(process.env.ANTHROPIC_API_KEY || FAKE);

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
const TYPE_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  pdf: "application/pdf",
};

/** One uploaded receipt file (our own /api/blob or local /uploads link) as base64. */
async function loadReceipt(url: string): Promise<{ type: string; data: string } | null> {
  let bytes: Buffer;
  let type = "";
  if (url.startsWith("/api/blob?u=")) {
    const blobUrl = new URLSearchParams(url.slice("/api/blob?".length)).get("u") ?? "";
    let host = "";
    try {
      host = new URL(blobUrl).hostname;
    } catch {}
    if (!host.endsWith(".vercel-storage.com")) return null;
    const res = await get(blobUrl, { access: "private", useCache: false, token: process.env.BLOB_READ_WRITE_TOKEN });
    if (!res || res.statusCode !== 200) return null;
    bytes = Buffer.from(await new Response(res.stream).arrayBuffer());
    type = res.blob.contentType ?? "";
  } else if (url.startsWith("/uploads/")) {
    bytes = await readFile(path.join(process.cwd(), "public", "uploads", path.basename(url)));
  } else return null;
  if (!IMAGE_TYPES.has(type) && type !== "application/pdf") type = TYPE_BY_EXT[url.split(".").pop()?.toLowerCase() ?? ""] ?? "";
  if (!IMAGE_TYPES.has(type) && type !== "application/pdf") return null;
  return { type, data: bytes.toString("base64") };
}

const SCHEMA = {
  type: "object",
  properties: {
    readable: { type: "boolean" },
    amount: { type: "number" },
    date: { type: "string" },
    merchant: { type: "string" },
    receipt_no: { type: "string" },
    items: { type: "string" },
    category: { type: "string", enum: [...MANUAL_EXPENSE_CATEGORIES] },
    other_label: { type: "string" },
    account_numbers: { type: "array", items: { type: "string" } },
    address: { type: "string" },
    note: { type: "string" },
  },
  required: [
    "readable", "amount", "date", "merchant", "receipt_no", "items", "category", "other_label", "account_numbers", "address", "note",
  ],
  additionalProperties: false,
} as const;

function instructions(today: string, lang: "zh" | "en") {
  const language = lang === "en" ? "English" : "Simplified Chinese";
  return `You read receipts, invoices and bills that staff of Bliss Rooms, a room-rental company in Malaysia, photograph to claim back money they spent. All the files are pages of one receipt. Answer with what they show:
- amount: the grand total actually paid, in RM, after discounts, SST / service tax and rounding. On a bill, the amount paid or due this time. 0 if you can't read it.
- date: the receipt's date as YYYY-MM-DD. Malaysian receipts put the day first: 05/11/2026 is 5 November 2026. Today is ${today}. "" if there is none.
- merchant: who was paid — the shop, company or person (e.g. "MR DIY", "Tenaga Nasional", "Ah Seng Plumbing"). "" if unknown.
- receipt_no: the receipt / invoice / bill number ("Resit No", "Invoice No", "No. Bil"); never a phone or account number. "" if none.
- items: what was bought or paid for, under 60 characters, in ${language}, keeping product names as printed (e.g. "灯泡 ×2、胶带" or "Light bulbs ×2, tape"). For a bill, what and which period (e.g. "电费 10月" or "Electricity, Oct").
- category: WATER (water and sewerage bills: Air Selangor, PBAPP, SAJ, Indah Water), ELECTRIC (TNB), WIFI (home internet: Unifi, TIME, Maxis, CelcomDigi fibre), CLEANING (cleaning services), MAINTENANCE (repair work or labour: plumber, electrician, aircon service, locksmith), SUPPLIES (household or repair supplies: Mr DIY, Eco-Shop, hardware shops, bulbs, cleaning products, tools), FURNITURE (furniture and appliances), TRANSPORT (petrol, toll, parking, Grab rides), ADVERTISING (ads, Facebook boosts, signage), OFFICE (stationery, printing, phone bills), OTHER (anything else).
- other_label: only for OTHER, a 2–6 word name for the expense in ${language} (e.g. "灭虫费" or "Pest control"); otherwise "".
- account_numbers: utility or internet account numbers printed (TNB "No. Akaun", water, Indah Water, internet). [] if none.
- address: the address the receipt or bill is for (bill-to, service or delivery address, e.g. "B-12-03, Pixel City Residence"), not the shop's own address. "" if none.
- readable: false if the files are not a receipt, invoice or bill, or the total is too blurry to read.
- note: anything the person should check, under 80 characters, in ${language} (e.g. "有两个总额，用了实付金额"). "" if nothing.
Never guess a number you can't see.`;
}

export type ReadOutcome = { ok: true; reading: Reading } | { ok: false; reason: string };

export async function readReceipts(urls: string[], lang: "zh" | "en", today: string): Promise<ReadOutcome> {
  try {
    let raw: unknown;
    if (FAKE) {
      raw = JSON.parse(await readFile(FAKE, "utf8"));
      await new Promise((r) => setTimeout(r, 1200));
    } else {
      const files = (await Promise.all(urls.map((u) => loadReceipt(u).catch(() => null)))).filter((f) => f !== null);
      if (!files.length) return { ok: false, reason: "no-file" };
      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY!,
          "anthropic-version": "2026-10-21",
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 4000,
          system: instructions(today, lang),
          messages: [
            {
              role: "user",
              content: [
                ...files.map((f) =>
                  f.type === "application/pdf"
                    ? { type: "document", source: { type: "base64", media_type: f.type, data: f.data } }
                    : { type: "image", source: { type: "base64", media_type: f.type, data: f.data } }
                ),
                { type: "text", text: "Read this receipt." },
              ],
            },
          ],
          output_config: { format: { type: "json_schema", schema: SCHEMA } },
        }),
        signal: AbortSignal.timeout(50_000),
      });
      if (!res.ok) {
        console.error("[receipt] Claude API", res.status, (await res.text()).slice(0, 500));
        return { ok: false, reason: `api-${res.status}` };
      }
      const body = (await res.json()) as { content?: { type: string; text?: string }[]; stop_reason?: string; usage?: unknown };
      console.info("[receipt] read", MODEL, JSON.stringify(body.usage));
      const answer = body.content?.find((b) => b.type === "text")?.text;
      if (!answer || body.stop_reason === "refusal" || body.stop_reason === "max_tokens") return { ok: false, reason: body.stop_reason ?? "empty" };
      raw = JSON.parse(answer);
    }
    return { ok: true, reading: cleanReading(raw, today, MANUAL_EXPENSE_CATEGORIES) };
  } catch (e) {
    console.error("[receipt] read failed", e);
    return { ok: false, reason: (e as Error).name === "TimeoutError" ? "timeout" : "error" };
  }
}

/* The total a receipt was read as rides back to the form in a signed token, so the amount a
 * reviewer is shown as "on the receipt" is the one actually read, not one sent by the form. */

const tokenKey = () => new TextEncoder().encode(`${process.env.AUTH_SECRET ?? ""}:receipt-reading`);
const photosKey = (urls: string[]) => createHash("sha256").update([...urls].sort().join("\n")).digest("base64url").slice(0, 22);

export function signReading(userId: string, urls: string[], amount: number | null): Promise<string> {
  return new SignJWT({ a: amount, p: photosKey(urls) })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("2d")
    .sign(tokenKey());
}

/** The read total, if the token was issued to this person for exactly these photos. */
export async function amountFromToken(token: string, userId: string, urls: string[]): Promise<number | null> {
  try {
    const { payload } = await jwtVerify(token, tokenKey(), { subject: userId });
    return payload.p === photosKey(urls) && typeof payload.a === "number" ? payload.a : null;
  } catch {
    return null;
  }
}

/** Live units for matching a receipt to its unit. */
export async function unitRefs(): Promise<UnitRef[]> {
  const units = await prisma.property.findMany({
    where: { OR: [{ status: null }, { status: { not: "Inactive" } }] },
    select: {
      propertyCode: true,
      name: true,
      building: { select: { name: true } },
      info: { select: { unitNo: true } },
      utilities: { select: { utilityType: true, provider: true, accountNo: true } },
    },
  });
  return units.map((u) => ({
    propertyCode: u.propertyCode,
    name: u.name,
    building: u.building?.name ?? null,
    unitNo: u.info?.unitNo ?? null,
    accounts: u.utilities.flatMap((a) => (a.accountNo ? [{ label: a.provider || a.utilityType, accountNo: a.accountNo }] : [])),
  }));
}

export interface SameReceiptClaim {
  claimCode: string;
  submittedByName: string;
  amount: number;
  expenseDate: string;
  status: string;
}

/** Claims (not rejected, last ~13 months) that look like this same receipt. */
export async function findSameReceipt(key: ReceiptKey): Promise<SameReceiptClaim[]> {
  if (!key.receiptNo && !key.merchant) return [];
  const rows = await prisma.expenseClaim.findMany({
    where: {
      status: { not: "REJECTED" },
      createdAt: { gte: new Date(Date.now() - 400 * 86_400_000) },
      OR: [{ receiptNo: { not: null } }, { merchant: { not: null } }],
    },
    select: { claimCode: true, submittedByName: true, amount: true, expenseDate: true, merchant: true, receiptNo: true, status: true },
    orderBy: { createdAt: "desc" },
    take: 1000,
  });
  return rows
    .filter((c) =>
      sameReceipt(key, { merchant: c.merchant, receiptNo: c.receiptNo, amount: Number(c.amount), date: c.expenseDate.toISOString().slice(0, 10) })
    )
    .slice(0, 3)
    .map((c) => ({
      claimCode: c.claimCode,
      submittedByName: c.submittedByName,
      amount: Number(c.amount),
      expenseDate: c.expenseDate.toISOString().slice(0, 10),
      status: c.status,
    }));
}
