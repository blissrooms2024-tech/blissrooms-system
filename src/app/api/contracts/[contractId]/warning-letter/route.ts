import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, type SessionPayload } from "@/lib/auth/session";
import { serialize } from "@/lib/serialize";
import { newId } from "@/lib/id";
import { sendWarningLetter } from "@/lib/mail";

function canView(user: SessionPayload, contract: { agentId: string; tenantId: string | null }) {
  if (user.role === "BOSS" || user.role === "ADMIN") return true;
  if (user.role === "AGENT" && contract.agentId === user.sub) return true;
  if (user.role === "TENANT" && contract.tenantId === user.sub) return true;
  return false;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ contractId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ success: false, message: "请重新登录" }, { status: 401 });

  const { contractId } = await params;
  const c = await prisma.contract.findUnique({ where: { contractCode: contractId } });
  if (!c) return NextResponse.json({ success: false, message: "找不到合同" }, { status: 404 });
  if (!canView(user, c)) {
    return NextResponse.json({ success: false, message: "没有权限查看这张合同" }, { status: 403 });
  }

  const letters = await prisma.warningLetter.findMany({
    where: { contractId: c.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ success: true, letters: serialize(letters) });
}

const schema = z.object({ message: z.string().trim().min(1) });

/** Admin sends a formal warning letter to the tenant (House Rules violation, repeated
 * lateness, etc.) — free-text body, emailed straight to the tenant's login address. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ contractId: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ success: false, message: "只有 Admin 可以发警告信" }, { status: 403 });
  }
  const { contractId } = await params;
  const c = await prisma.contract.findUnique({ where: { contractCode: contractId }, include: { tenant: true } });
  if (!c) return NextResponse.json({ success: false, message: "找不到合同" }, { status: 404 });
  if (!c.tenant) return NextResponse.json({ success: false, message: "这张合同还没有关联租客账号" }, { status: 400 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "请填警告内容" }, { status: 400 });
  }

  await sendWarningLetter(c.tenant, c.contractCode, parsed.data.message, user.name);
  await prisma.warningLetter.create({
    data: {
      letterCode: await newId("WL"),
      contractId: c.id,
      message: parsed.data.message,
      sentBy: user.name,
      triggeredBy: "admin",
    },
  });

  return NextResponse.json({ success: true, message: `✅ 警告信已发给 ${c.tenant.name}` });
}
