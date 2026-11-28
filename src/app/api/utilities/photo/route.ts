import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { uploadDataUrl } from "@/lib/storage";

const schema = z.object({ dataUrl: z.string().min(1) });

/** One meter photo at a time (already shrunk in the browser) — returns its private URL, which
 * is then sent along with the readings. Keeps every request well under Vercel's size limit. */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ success: false, message: "没有权限" }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !/^data:image\//.test(parsed.data.dataUrl)) {
    return NextResponse.json({ success: false, message: "只能上传照片" }, { status: 400 });
  }
  try {
    const url = await uploadDataUrl(parsed.data.dataUrl, `METER_${Date.now()}.jpg`);
    return NextResponse.json({ success: true, url });
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message || "上传失败" }, { status: 500 });
  }
}
