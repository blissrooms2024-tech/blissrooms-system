import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** Verify-email link target. Renders a tiny standalone result page (no app shell, matches
 * the original `simplePage_()` behaviour) rather than an API JSON response. */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  let ok = false;
  let name = "";

  if (token) {
    const user = await prisma.user.findFirst({ where: { verifyToken: token } });
    if (user) {
      await prisma.user.update({ where: { id: user.id }, data: { verified: true, verifyToken: null } });
      ok = true;
      name = user.name;
    }
  }

  const inner = ok
    ? `<h2 style="color:#1e7e34;">✅ 验证成功 Verified!</h2><p>你好 ${escapeHtml(
        name
      )}, 你的邮箱已验证。现在可以关闭此页, 回去登录。</p>`
    : `<h2 style="color:#c0392b;">链接无效或已使用</h2><p>This link is invalid or already used.</p>`;

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Bliss Rooms</title></head>
<body style="font-family:Segoe UI,Arial,sans-serif;">
<div style="max-width:420px;margin:60px auto;text-align:center;padding:30px;border:1px solid #eee;border-radius:12px;">
<div style="font-size:22px;font-weight:700;color:#0b5394;margin-bottom:14px;">🏠 Bliss Rooms</div>
${inner}
</div></body></html>`;

  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
