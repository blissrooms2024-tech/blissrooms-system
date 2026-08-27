import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return null;
  return user;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ success: false, message: "只有 Admin 可看" }, { status: 403 });
  }
  const { userId } = await params;
  const u = await prisma.user.findUnique({ where: { userCode: userId } });
  if (!u) return NextResponse.json({ success: false, message: "找不到用户" }, { status: 404 });

  return NextResponse.json({
    success: true,
    user: {
      userCode: u.userCode,
      name: u.name,
      email: u.email,
      role: u.role,
      phone: u.phone,
      ic: u.ic,
      commRate: u.commRate ? Number(u.commRate) : null,
      status: u.status,
    },
  });
}

const editSchema = z.object({
  name: z.string().trim().optional(),
  email: z.string().trim().toLowerCase().email().optional(),
  phone: z.string().trim().optional(),
  ic: z.string().trim().optional(),
  role: z.enum(["BOSS", "ADMIN", "AGENT", "TENANT", "WORKER"]).optional(),
  status: z.enum(["ACTIVE", "DISABLED"]).optional(),
  commRate: z.coerce.number().optional(),
  newPassword: z.string().trim().min(4).optional().or(z.literal("")),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ success: false, message: "只有 Admin 可以改" }, { status: 403 });
  }
  const { userId } = await params;
  const u = await prisma.user.findUnique({ where: { userCode: userId } });
  if (!u) return NextResponse.json({ success: false, message: "找不到用户" }, { status: 404 });

  const parsed = editSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "资料格式不对" }, { status: 400 });
  }
  const d = parsed.data;

  const data: Record<string, unknown> = {
    name: d.name ?? u.name,
    phone: d.phone ?? u.phone,
    ic: d.ic ?? u.ic,
    role: d.role ?? u.role,
    status: d.status ?? u.status,
  };
  if (d.commRate !== undefined) data.commRate = d.commRate;
  if (d.newPassword) data.passwordHash = await hashPassword(d.newPassword);

  if (d.email && d.email !== u.email) {
    const dup = await prisma.user.findUnique({ where: { email: d.email } });
    if (dup) return NextResponse.json({ success: false, message: "这个 Email 已经有人用了" }, { status: 409 });
    data.email = d.email;
  }

  const updated = await prisma.user.update({ where: { userCode: userId }, data });

  return NextResponse.json({ success: true, message: `✅ 用户已更新: ${updated.name}` });
}
