import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";
import { newId } from "@/lib/id";
import { RULES } from "@/lib/config";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ success: false, message: "请重新登录" }, { status: 401 });
  if (user.role !== "ADMIN") {
    return NextResponse.json({ success: false, message: "只有 Admin 可看用户" }, { status: 403 });
  }

  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json({
    success: true,
    users: users.map((u) => ({
      userCode: u.userCode,
      name: u.name,
      email: u.email,
      role: u.role,
      phone: u.phone,
      status: u.status,
      verified: u.verified,
    })),
  });
}

const createSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(["BOSS", "ADMIN", "AGENT", "TENANT", "WORKER"]),
  phone: z.string().trim().optional().default(""),
  ic: z.string().trim().optional().default(""),
  password: z.string().trim().optional().default("1234"),
  commRate: z.coerce.number().optional(),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ success: false, message: "只有 Admin 可建用户" }, { status: 403 });
  }
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "姓名/Email/角色一定要填" }, { status: 400 });
  }
  const d = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email: d.email } });
  if (existing) {
    return NextResponse.json({ success: false, message: "这个 Email 已经有人用了" }, { status: 409 });
  }

  const pw = d.password || "1234";
  await prisma.user.create({
    data: {
      userCode: await newId("U"),
      name: d.name,
      email: d.email,
      passwordHash: await hashPassword(pw),
      role: d.role,
      phone: d.phone,
      ic: d.ic,
      commRate: d.role === "AGENT" ? d.commRate || RULES.DEFAULT_COMM_RATE : null,
      status: "ACTIVE",
    },
  });

  return NextResponse.json({ success: true, message: `✅ 用户已建: ${d.name} (密码: ${pw})` });
}
