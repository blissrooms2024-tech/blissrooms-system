import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";

/** Self-service profile — unlike /api/users/[userId] (Admin-only, any user), this only ever
 * reads/writes the caller's own row, and only the fields that are safe for someone to change
 * about themselves (not email/role/status/commRate — those stay Admin-controlled). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ success: false, message: "请重新登录" }, { status: 401 });

  const u = await prisma.user.findUnique({ where: { id: user.sub } });
  if (!u) return NextResponse.json({ success: false, message: "找不到用户" }, { status: 404 });

  return NextResponse.json({
    success: true,
    profile: {
      userCode: u.userCode,
      name: u.name,
      email: u.email,
      role: u.role,
      phone: u.phone,
      ic: u.ic,
      bankName: u.bankName,
      bankAccountName: u.bankAccountName,
      bankAccountNumber: u.bankAccountNumber,
    },
  });
}

const editSchema = z.object({
  name: z.string().trim().min(1),
  phone: z.string().trim().optional().default(""),
  ic: z.string().trim().optional().default(""),
  bankName: z.string().trim().optional().default(""),
  bankAccountName: z.string().trim().optional().default(""),
  bankAccountNumber: z.string().trim().optional().default(""),
});

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ success: false, message: "请重新登录" }, { status: 401 });

  const parsed = editSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "姓名一定要填" }, { status: 400 });
  }
  const d = parsed.data;

  await prisma.user.update({
    where: { id: user.sub },
    data: {
      name: d.name,
      phone: d.phone || null,
      ic: d.ic || null,
      bankName: d.bankName || null,
      bankAccountName: d.bankAccountName || null,
      bankAccountNumber: d.bankAccountNumber || null,
    },
  });

  return NextResponse.json({ success: true, message: "✅ 资料已更新" });
}
