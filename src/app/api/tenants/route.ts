import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";
import { newId } from "@/lib/id";

/**
 * Search existing tenant profiles by IC/name/email, so Agent/Admin pick the tenant that
 * already exists instead of retyping their details on every contract — retyping was how a
 * contract could end up linked to the wrong (or a brand-new, duplicate) tenant account.
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ success: false, message: "请重新登录" }, { status: 401 });
  if (!["ADMIN", "AGENT", "BOSS"].includes(user.role)) {
    return NextResponse.json({ success: false, message: "没有权限" }, { status: 403 });
  }

  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  if (!q) return NextResponse.json({ success: true, tenants: [] });

  const tenants = await prisma.user.findMany({
    where: {
      role: "TENANT",
      OR: [
        { ic: { contains: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ],
    },
    select: { userCode: true, name: true, ic: true, email: true, phone: true },
    orderBy: { name: "asc" },
    take: 10,
  });

  return NextResponse.json({ success: true, tenants });
}

const createSchema = z.object({
  name: z.string().trim().min(1),
  ic: z.string().trim().min(1),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().optional().default(""),
});

/** Creates a tenant profile up-front (Agent or Admin), separate from filling a contract. */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ success: false, message: "请重新登录" }, { status: 401 });
  if (!["ADMIN", "AGENT"].includes(user.role)) {
    return NextResponse.json({ success: false, message: "只有 Agent 或 Admin 可以建租客资料" }, { status: 403 });
  }

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "姓名/IC/Email 一定要填" }, { status: 400 });
  }
  const d = parsed.data;

  const existingEmail = await prisma.user.findUnique({ where: { email: d.email } });
  if (existingEmail) {
    return NextResponse.json({ success: false, message: "这个 Email 已经有账号了，直接搜索选用" }, { status: 409 });
  }
  const existingIc = await prisma.user.findFirst({ where: { role: "TENANT", ic: d.ic } });
  if (existingIc) {
    return NextResponse.json(
      { success: false, message: `这个 IC 已经建过租客资料了 (${existingIc.name})，直接搜索选用` },
      { status: 409 }
    );
  }

  const icDigits = d.ic.replace(/\D/g, "");
  const pw = icDigits.length >= 4 ? icDigits.slice(-4) : "1234";

  const created = await prisma.user.create({
    data: {
      userCode: await newId("U"),
      name: d.name,
      email: d.email,
      passwordHash: await hashPassword(pw),
      role: "TENANT",
      phone: d.phone,
      ic: d.ic,
      status: "ACTIVE",
    },
  });

  return NextResponse.json({
    success: true,
    message: `✅ 租客资料已建: ${d.name} (登录密码: ${pw})`,
    tenant: { userCode: created.userCode, name: created.name, ic: created.ic, email: created.email, phone: created.phone },
  });
}
