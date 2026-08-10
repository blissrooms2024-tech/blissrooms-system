import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { uploadDataUrl } from "@/lib/storage";

const schema = z.object({
  who: z.enum(["agent", "tenant"]),
  dataUrl: z.string().min(1),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ contractId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ success: false, message: "请重新登录" }, { status: 401 });

  const { contractId } = await params;
  const c = await prisma.contract.findUnique({ where: { contractCode: contractId } });
  if (!c) return NextResponse.json({ success: false, message: "找不到合同" }, { status: 404 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "请先签名" }, { status: 400 });
  }
  const { who, dataUrl } = parsed.data;

  if (c.status !== "PENDING_SIGN" && c.status !== "ACTIVE") {
    return NextResponse.json({ success: false, message: "合同还没批准, 不能签名" }, { status: 409 });
  }

  if (who === "agent") {
    if (c.agentId !== user.sub) {
      return NextResponse.json({ success: false, message: "只有负责这张合同的 Agent 本人可以签" }, { status: 403 });
    }
    if (c.agentSignature) {
      return NextResponse.json({ success: false, message: "Agent 已经签过了" }, { status: 409 });
    }
  } else {
    if (c.tenantId !== user.sub) {
      return NextResponse.json({ success: false, message: "只有这张合同的租客本人可以签" }, { status: 403 });
    }
    if (!c.agentSignature) {
      return NextResponse.json({ success: false, message: "请等 Agent 先签合同" }, { status: 409 });
    }
    if (!c.icFront || !c.icBack) {
      return NextResponse.json({ success: false, message: "请先上传 IC 正反面才能签名" }, { status: 409 });
    }
    if (c.tenantSignature) {
      return NextResponse.json({ success: false, message: "你已经签过了" }, { status: 409 });
    }
  }

  let signUrl: string;
  try {
    signUrl = await uploadDataUrl(dataUrl, `${contractId}_sign_${who}_${Date.now()}.png`);
  } catch (e) {
    return NextResponse.json(
      { success: false, message: "签名保存失败: " + (e instanceof Error ? e.message : String(e)) },
      { status: 500 }
    );
  }

  const now = new Date();
  await prisma.contract.update({
    where: { contractCode: contractId },
    data:
      who === "agent"
        ? { agentSignature: signUrl, agentSignDate: now }
        : { tenantSignature: signUrl, tenantSignDate: now },
  });

  const c2 = await prisma.contract.findUnique({ where: { contractCode: contractId } });
  let message = `✅ ${who === "agent" ? "Agent" : "租客"} 签名成功`;

  if (c2?.agentSignature && c2?.tenantSignature && c2.status !== "ACTIVE") {
    await prisma.contract.update({ where: { contractCode: contractId }, data: { status: "ACTIVE" } });
    await prisma.room.update({
      where: { id: c2.roomId },
      data: { status: "OCCUPIED", currentTenantId: c2.tenantId },
    });
    message += " | 🎉 双方已签, 合同生效, 房间转为已出租";
  }

  return NextResponse.json({ success: true, message, signUrl });
}
