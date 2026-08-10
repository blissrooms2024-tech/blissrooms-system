import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { createSessionToken, setSessionCookie } from "@/lib/auth/session";

const schema = z.object({
  email: z.string().trim().toLowerCase().min(1),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "请填 Email 和密码" }, { status: 400 });
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({ success: false, message: "找不到这个 Email" }, { status: 401 });
  }
  if (user.status === "DISABLED") {
    return NextResponse.json({ success: false, message: "此账号已停用" }, { status: 403 });
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ success: false, message: "密码错误" }, { status: 401 });
  }

  const token = await createSessionToken({
    sub: user.id,
    userCode: user.userCode,
    name: user.name,
    email: user.email,
    role: user.role,
    verified: user.verified,
  });
  await setSessionCookie(token);

  return NextResponse.json({
    success: true,
    user: {
      userCode: user.userCode,
      name: user.name,
      email: user.email,
      role: user.role,
      verified: user.verified,
    },
  });
}
