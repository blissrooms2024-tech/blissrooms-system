import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

const schema = z.object({
  oldPassword: z.string().min(1),
  newPassword: z.string().min(4),
});

export async function POST(req: NextRequest) {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ success: false, message: "请重新登录" }, { status: 401 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "新密码至少4位" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.sub } });
  if (!user) return NextResponse.json({ success: false, message: "找不到账号" }, { status: 404 });

  const ok = await verifyPassword(parsed.data.oldPassword, user.passwordHash);
  if (!ok) return NextResponse.json({ success: false, message: "旧密码不对" }, { status: 400 });

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(parsed.data.newPassword) },
  });

  return NextResponse.json({ success: true, message: "✅ 密码已更改" });
}
