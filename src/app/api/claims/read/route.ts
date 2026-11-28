import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { canSubmitClaims, isOwnUploadUrl, MAX_RECEIPTS_PER_CLAIM } from "@/lib/claims";
import { findSameReceipt, readReceipts, receiptReaderOn, signReading, unitRefs } from "@/lib/receiptReader";
import { matchUnit } from "@/lib/receiptMatch";
import { todayMY } from "@/lib/todoText";

// A photo read by Claude usually takes a few seconds; give slow ones room.
export const maxDuration = 60;

const schema = z.object({
  receipts: z.array(z.string().min(1)).min(1).max(MAX_RECEIPTS_PER_CLAIM),
  locale: z.enum(["zh", "en"]).optional().default("zh"),
});

/**
 * POST /api/claims/read — reads a claim's receipt photos so the form can fill itself in:
 * what the receipt says, which unit it's probably for, and earlier claims for the same receipt.
 * { available: false } when reading isn't set up (no ANTHROPIC_API_KEY): the form stays manual.
 * Reading changes nothing, so it isn't in the activity log.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !canSubmitClaims(user)) {
    return NextResponse.json({ success: false, message: "只有 Admin 和 Worker 可以提交报销" }, { status: 403 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !parsed.data.receipts.every(isOwnUploadUrl)) {
    return NextResponse.json({ success: false, message: "单据文件无效，请重新上传" }, { status: 400 });
  }
  if (!receiptReaderOn()) return NextResponse.json({ success: true, available: false });

  const { receipts, locale } = parsed.data;
  const out = await readReceipts(receipts, locale, todayMY());
  if (!out.ok) return NextResponse.json({ success: true, available: true, reading: null, reason: out.reason });

  const r = out.reading;
  const [units, sameAs, readToken] = await Promise.all([
    unitRefs(),
    findSameReceipt({ merchant: r.merchant, receiptNo: r.receiptNo, amount: r.amount, date: r.date }),
    signReading(user.sub, receipts, r.amount),
  ]);
  return NextResponse.json({
    success: true,
    available: true,
    reading: r,
    unit: matchUnit(r, units),
    sameAs,
    readToken,
  });
}
