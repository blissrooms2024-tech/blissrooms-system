import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { uploadDataUrl } from "@/lib/storage";

const schema = z.object({
  itemKey: z.string().min(1),
  dataUrl: z.string().min(1),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ contractId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ success: false, message: "请重新登录" }, { status: 401 });

  const { contractId } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "请先选图片" }, { status: 400 });
  }

  try {
    const url = await uploadDataUrl(
      parsed.data.dataUrl,
      `${contractId}_move_${parsed.data.itemKey}_${Date.now()}.jpg`
    );
    return NextResponse.json({ success: true, url });
  } catch (e) {
    return NextResponse.json(
      { success: false, message: "上传失败: " + (e instanceof Error ? e.message : String(e)) },
      { status: 500 }
    );
  }
}
