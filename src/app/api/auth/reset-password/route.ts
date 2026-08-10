import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";

const schema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(4),
});

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "新密码至少4位" }, { status: 400 });
  }
  const { token, newPassword } = parsed.data;

  const user = await prisma.user.findFirst({ where: { resetToken: token } });
  if (!user) return NextResponse.json({ success: false, message: "链接无效" }, { status: 400 });
  if (user.resetExpiry && user.resetExpiry < new Date()) {
    return NextResponse.json({ success: false, message: "链接已过期, 请重新申请" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(newPassword), resetToken: null, resetExpiry: null },
  });

  return NextResponse.json({ success: true, message: "✅ 密码已重设, 请用新密码登录" });
}
