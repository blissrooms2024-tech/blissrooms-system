import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";
import { sendVerifyEmail } from "@/lib/mail";
import { withActivity } from "@/lib/activity";

async function handlePOST(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const admin = await getCurrentUser();
  if (!admin || (admin.role !== "ADMIN" && admin.role !== "BOSS")) {
    return NextResponse.json({ success: false, message: "只有 Boss / Admin 可以发" }, { status: 403 });
  }
  const { userId } = await params;
  const user = await prisma.user.findUnique({ where: { userCode: userId } });
  if (!user) return NextResponse.json({ success: false, message: "找不到用户" }, { status: 404 });
  if (!user.email) return NextResponse.json({ success: false, message: "这个用户没有 Email" }, { status: 400 });
  if (user.verified) {
    return NextResponse.json({ success: false, message: "这个账号已经验证过了" }, { status: 400 });
  }

  // The tenant needs to know their password to log in, but only a hash is ever stored.
  // Reissue the same deterministic default used at account creation (IC last 4 digits, or
  // "1234" if there's no IC) and tell them what it is — this intentionally resets the
  // password so the one emailed is always the one that actually works, even if the account
  // somehow already had a different password set.
  const icDigits = (user.ic || "").replace(/\D/g, "");
  const password = icDigits.length >= 4 ? icDigits.slice(-4) : "1234";

  const token = randomUUID();
  await prisma.user.update({
    where: { userCode: userId },
    data: { verifyToken: token, passwordHash: await hashPassword(password) },
  });
  const status = await sendVerifyEmail(user, token, password, admin.name);

  if (status === "skipped-no-api-key") {
    return NextResponse.json(
      { success: false, message: "⚠️ 没配置发信服务 (GMAIL_USER/GMAIL_APP_PASSWORD 或 RESEND_API_KEY)，邮件没真的发出去（本地/测试环境正常，生产环境要检查 Vercel 环境变量）" },
      { status: 502 }
    );
  }
  if (status !== "sent") {
    return NextResponse.json(
      { success: false, message: `⚠️ 邮件发送失败: ${status}` },
      { status: 502 }
    );
  }

  return NextResponse.json({ success: true, message: `✅ 验证邮件已发去 ${user.email}（登录密码: ${password}）` });
}

export const POST = withActivity(handlePOST);
