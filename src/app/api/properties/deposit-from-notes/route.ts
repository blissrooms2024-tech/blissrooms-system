import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { extractDepositFromNotes } from "@/lib/parseDeposit";
import { withActivity } from "@/lib/activity";

/** Candidates: master-lease properties (ownerRentalAmount set) with no Owner Deposit on file
 * yet, whose notes do contain a parseable deposit figure. Never touches a property that
 * already has an ownerDeposit — this only fills in gaps, it doesn't correct existing values. */
async function findCandidates() {
  const properties = await prisma.property.findMany({
    where: { ownerRentalAmount: { not: null }, ownerDeposit: null },
    select: { propertyCode: true, name: true, notes: true },
  });
  return properties
    .map((p) => ({ ...p, parsedAmount: extractDepositFromNotes(p.notes) }))
    .filter((p): p is typeof p & { parsedAmount: number } => p.parsedAmount !== null);
}

/** Preview only — no writes. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ success: false, message: "只有 Admin 可以用" }, { status: 403 });
  }
  const candidates = await findCandidates();
  return NextResponse.json({ success: true, candidates });
}

/** Applies the same candidates found by GET — recomputed here rather than trusting whatever
 * the client last saw, in case a property changed in between the preview and the confirm. */
async function handlePOST() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ success: false, message: "只有 Admin 可以用" }, { status: 403 });
  }
  const candidates = await findCandidates();
  for (const c of candidates) {
    await prisma.property.update({ where: { propertyCode: c.propertyCode }, data: { ownerDeposit: c.parsedAmount } });
  }
  return NextResponse.json({
    success: true,
    message: candidates.length > 0 ? `✅ 已经帮 ${candidates.length} 个楼盘填好押金` : "✅ 检查完了，没有需要填的",
    updated: candidates.length,
  });
}

export const POST = withActivity(handlePOST);
