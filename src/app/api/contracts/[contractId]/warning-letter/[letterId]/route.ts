import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";

/** Admin retracts a warning letter record (sent by mistake, situation resolved, etc.).
 * This only removes the record — it does not (and cannot) un-send the email already sent. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ contractId: string; letterId: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ success: false, message: "只有 Admin 可以撤销警告信" }, { status: 403 });
  }
  const { contractId, letterId } = await params;
  const c = await prisma.contract.findUnique({ where: { contractCode: contractId } });
  if (!c) return NextResponse.json({ success: false, message: "找不到合同" }, { status: 404 });

  const letter = await prisma.warningLetter.findUnique({ where: { letterCode: letterId } });
  if (!letter || letter.contractId !== c.id) {
    return NextResponse.json({ success: false, message: "找不到这封警告信" }, { status: 404 });
  }

  await prisma.warningLetter.delete({ where: { letterCode: letterId } });

  return NextResponse.json({ success: true, message: "✅ 警告信记录已撤销" });
}
