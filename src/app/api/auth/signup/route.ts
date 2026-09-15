import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { newId } from "@/lib/id";
import { notifyAdminsAgentSignup } from "@/lib/mail";

const schema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().optional().default(""),
  ic: z.string().trim().optional().default(""),
  password: z.string().min(6),
});

/** Public self-registration for Agents only — creates the account as PENDING (can't log in
 * yet) and pings every Admin to review and approve it. */
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message || "请填姓名/Email/密码 (密码至少6位)";
    return NextResponse.json({ success: false, message: msg }, { status: 400 });
  }
  const d = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email: d.email } });
  if (existing) {
    return NextResponse.json({ success: false, message: "这个 Email 已经有人用了" }, { status: 409 });
  }

  const userCode = await newId("U");
  await prisma.user.create({
    data: {
      userCode,
      name: d.name,
      email: d.email,
      passwordHash: await hashPassword(d.password),
      role: "AGENT",
      phone: d.phone,
      ic: d.ic,
      status: "PENDING",
    },
  });

  await notifyAdminsAgentSignup({ userCode, name: d.name, email: d.email }, d.name);

  return NextResponse.json({ success: true, message: "✅ 注册成功！请等 Admin 批准后才能登入" });
}
