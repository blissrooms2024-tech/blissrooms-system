import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { sendVerifyEmail } from "@/lib/mail";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json({ success: false, message: "只有 Admin 可以发" }, { status: 403 });
  }
  const { userId } = await params;
  const user = await prisma.user.findUnique({ where: { userCode: userId } });
  if (!user) return NextResponse.json({ success: false, message: "找不到用户" }, { status: 404 });
  if (!user.email) return NextResponse.json({ success: false, message: "这个用户没有 Email" }, { status: 400 });
  if (user.verified) {
    return NextResponse.json({ success: false, message: "这个账号已经验证过了" }, { status: 400 });
  }

  const token = randomUUID();
  await prisma.user.update({ where: { userCode: userId }, data: { verifyToken: token } });
  await sendVerifyEmail(user, token, admin.name);

  return NextResponse.json({ success: true, message: `✅ 验证邮件已发去 ${user.email}` });
}
