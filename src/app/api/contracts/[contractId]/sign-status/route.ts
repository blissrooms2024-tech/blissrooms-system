import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ contractId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ success: false, message: "请重新登录" }, { status: 401 });

  const { contractId } = await params;
  const c = await prisma.contract.findUnique({ where: { contractCode: contractId } });
  if (!c) return NextResponse.json({ success: false, message: "找不到合同" }, { status: 404 });

  const approved = c.status === "PENDING_SIGN" || c.status === "ACTIVE";

  return NextResponse.json({
    success: true,
    status: c.status,
    isAgent: c.agentId === user.sub,
    isTenant: c.tenantId === user.sub,
    role: user.role,
    approved,
    agentSigned: !!c.agentSignature,
    tenantSigned: !!c.tenantSignature,
    hasIC: !!c.icFront && !!c.icBack,
  });
}
