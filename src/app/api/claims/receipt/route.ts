import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { uploadDataUrl } from "@/lib/storage";
import { canUseClaims } from "@/lib/claims";

const schema = z.object({ dataUrl: z.string().min(1) });

/** Uploads one receipt photo/PDF (or a pay-back transfer slip) and returns its private URL.
 * Files go up one at a time so a claim with several photos never hits Vercel's request-size
 * limit; the claim itself is then saved with the list of returned URLs. */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !canUseClaims(user)) {
    return NextResponse.json({ success: false, message: "没有权限" }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, message: "请先选文件" }, { status: 400 });

  const mime = parsed.data.dataUrl.match(/^data:([^;]+);base64,/)?.[1] ?? "";
  if (!mime.startsWith("image/") && mime !== "application/pdf") {
    return NextResponse.json({ success: false, message: "只能上传照片或 PDF" }, { status: 400 });
  }

  try {
    const ext = mime === "application/pdf" ? "pdf" : "jpg";
    const url = await uploadDataUrl(parsed.data.dataUrl, `CLAIM_${user.userCode}_${Date.now()}.${ext}`);
    return NextResponse.json({ success: true, url });
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message || "上传失败" }, { status: 500 });
  }
}
