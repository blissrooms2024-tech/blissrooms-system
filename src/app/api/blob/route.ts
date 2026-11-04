import { NextRequest, NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { getCurrentUser } from "@/lib/auth/session";

/**
 * Streams a private Vercel Blob back to the browser. IC photos and signatures are stored
 * with private access (public Blob stores are no longer offered), so <img> tags can't hit
 * their URLs directly — every read has to go through here, gated on a logged-in session.
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ success: false, message: "请重新登录" }, { status: 401 });

  const u = req.nextUrl.searchParams.get("u");
  if (!u) return NextResponse.json({ success: false, message: "缺少参数" }, { status: 400 });

  let url: URL;
  try {
    url = new URL(u);
  } catch {
    return NextResponse.json({ success: false, message: "无效地址" }, { status: 400 });
  }
  if (!url.hostname.endsWith(".vercel-storage.com")) {
    return NextResponse.json({ success: false, message: "无效地址" }, { status: 400 });
  }

  // useCache: false — a blob just uploaded moments ago can otherwise read back as
  // "not found" from a stale CDN cache entry (e.g. a tenant uploading a slip, then Admin
  // opening it within the same minute); this is a low-traffic private-file route, so the
  // extra origin-fetch latency is worth never showing a broken image for a real upload.
  const result = await get(u, { access: "private", useCache: false, token: process.env.BLOB_READ_WRITE_TOKEN });
  if (!result || result.statusCode !== 200) {
    return NextResponse.json({ success: false, message: "文件不存在" }, { status: 404 });
  }

  return new NextResponse(result.stream, {
    headers: {
      "content-type": result.blob.contentType || "application/octet-stream",
      "cache-control": "private, max-age=3600",
    },
  });
}
