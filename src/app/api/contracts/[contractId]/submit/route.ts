import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ contractId: string }> }
) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "AGENT" && user.role !== "ADMIN")) {
    return NextResponse.json({ success: false, message: "只有 Agent 或 Admin 可以提交" }, { status: 403 });
  }
  const { contractId } = await params;
  const contract = await prisma.contract.findUnique({ where: { contractCode: contractId } });
  if (!contract) return NextResponse.json({ success: false, message: "找不到合同" }, { status: 404 });
  if (user.role === "AGENT" && contract.agentId !== user.sub) {
    return NextResponse.json({ success: false, message: "只能提交自己名下的合同" }, { status: 403 });
  }
  if (contract.status !== "DRAFT") {
    return NextResponse.json({ success: false, message: "只有草稿可以提交" }, { status: 409 });
  }

  await prisma.contract.update({
    where: { contractCode: contractId },
    data: { status: "PENDING_APPROVE", autoDeleteAt: null },
  });

  return NextResponse.json({ success: true, message: "✅ 已提交, 等 Admin 批" });
}
