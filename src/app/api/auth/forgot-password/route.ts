import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendResetEmail } from "@/lib/mail";

const schema = z.object({ email: z.string().trim().toLowerCase().min(1) });

const GENERIC_MSG = "如果这个 Email 有账号, 重设邮件已寄出。";

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: true, message: GENERIC_MSG });
  }

  // Always return the same generic message, whether or not the email exists —
  // don't let this endpoint be used to enumerate registered accounts.
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (user) {
    const token = randomUUID();
    const expiry = new Date(Date.now() + 60 * 60 * 1000);
    await prisma.user.update({ where: { id: user.id }, data: { resetToken: token, resetExpiry: expiry } });
    await sendResetEmail(user, token);
  }

  return NextResponse.json({ success: true, message: GENERIC_MSG });
}
