import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ contractId: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ success: false, message: "只有 Admin 可以批" }, { status: 403 });
  }
  const { contractId } = await params;
  const contract = await prisma.contract.findUnique({ where: { contractCode: contractId } });
  if (!contract) return NextResponse.json({ success: false, message: "找不到合同" }, { status: 404 });
  if (contract.status !== "PENDING_APPROVE") {
    return NextResponse.json({ success: false, message: "这合同不在等批状态" }, { status: 409 });
  }

  await prisma.contract.update({
    where: { contractCode: contractId },
    data: { status: "PENDING_SIGN", approvedBy: user.name, approvedAt: new Date() },
  });

  return NextResponse.json({ success: true, message: "✅ 已批准, 现在可以签名了" });
}
