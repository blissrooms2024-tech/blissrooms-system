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
  if (user.status === "PENDING") {
    return NextResponse.json({ success: false, message: "你的账号还在等 Admin 审核，请耐心等待" }, { status: 403 });
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ success: false, message: "密码错误" }, { status: 401 });
  }

  // A pure Tenant account whose every contract has already passed its expiredDate is locked
  // out until Admin renews it (extends the date, or opens a new contract) — not an Agent
  // logging into their own account just because they also happen to be the tenant on a
  // contract of their own, and not a Tenant who's never had a contract yet (a fresh signup
  // still needs to be able to log in and see the "还没有租约" empty state).
  if (user.role === "TENANT") {
    const contracts = await prisma.contract.findMany({
      where: { tenantId: user.id },
      select: { expiredDate: true },
    });
    if (contracts.length > 0) {
      const now = new Date();
      const allExpired = contracts.every((c) => c.expiredDate && c.expiredDate < now);
      if (allExpired) {
        return NextResponse.json(
          { success: false, message: "你的租约已到期，请联系 Admin 续约后才能登入" },
          { status: 403 }
        );
      }
    }
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
