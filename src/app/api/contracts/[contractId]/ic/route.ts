import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { uploadDataUrl } from "@/lib/storage";

const schema = z.object({
  side: z.enum(["front", "back"]),
  dataUrl: z.string().min(1),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ contractId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ success: false, message: "请重新登录" }, { status: 401 });

  const { contractId } = await params;
  const contract = await prisma.contract.findUnique({ where: { contractCode: contractId } });
  if (!contract) return NextResponse.json({ success: false, message: "找不到合同" }, { status: 404 });

  const isTenant = contract.tenantId === user.sub;
  if (!isTenant) {
    return NextResponse.json({ success: false, message: "只有这张合同的租客本人可以上传 IC" }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "请先选图片" }, { status: 400 });
  }

  try {
    const url = await uploadDataUrl(
      parsed.data.dataUrl,
      `${contractId}_IC_${parsed.data.side}_${Date.now()}.png`
    );
    await prisma.contract.update({
      where: { contractCode: contractId },
      data: parsed.data.side === "back" ? { icBack: url } : { icFront: url },
    });
    return NextResponse.json({
      success: true,
      message: `✅ IC ${parsed.data.side === "back" ? "背面" : "正面"} 已上传`,
      url,
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, message: "上传失败: " + (e instanceof Error ? e.message : String(e)) },
      { status: 500 }
    );
  }
}
