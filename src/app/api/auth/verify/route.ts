import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** Verify-email link target. Renders a tiny standalone result page (no app shell, matches
 * the original `simplePage_()` behaviour) rather than an API JSON response.
 *
 * Deliberately does NOT clear verifyToken on success. Email clients (Gmail's link/safe-browsing
 * scanner, corporate mail gateways, antivirus link-checkers) commonly auto-visit every link in
 * an email before the recipient ever clicks it — if that first automated hit consumed the
 * token, the user's own click would find no match and see a false "already used" error. Instead
 * this is idempotent: any GET carrying a token that still matches a user marks them verified
 * (a no-op if already true) and succeeds, so a scanner pre-fetch and the real click both work. */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  let ok = false;
  let name = "";

  if (token) {
    const user = await prisma.user.findFirst({ where: { verifyToken: token } });
    if (user) {
      if (!user.verified) {
        await prisma.user.update({ where: { id: user.id }, data: { verified: true } });
      }
      ok = true;
      name = user.name;
    }
  }

  const inner = ok
    ? `<h2 style="color:#1e7e34;">✅ Verified!</h2><p>Hi ${escapeHtml(
        name
      )}, your email has been verified. You can close this page and log in.</p>`
    : `<h2 style="color:#c0392b;">Invalid Link</h2><p>This verification link is invalid.</p>`;

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
