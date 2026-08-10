import { Resend } from "resend";
import { prisma } from "@/lib/prisma";
import { newId } from "@/lib/id";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.EMAIL_FROM || "Bliss Rooms <onboarding@resend.dev>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

async function send(to: string, subject: string, html: string, type: string, relatedId: string, triggeredBy: string) {
  let status = "sent";
  try {
    if (resend) {
      await resend.emails.send({ from: FROM, to, subject, html });
    } else {
      // No RESEND_API_KEY configured yet — log instead of throwing, so local dev keeps working.
      console.log(`[mail:${type}] (RESEND_API_KEY not set, not actually sent) to=${to} subject=${subject}`);
      status = "skipped-no-api-key";
    }
  } catch (e) {
    status = "failed: " + (e instanceof Error ? e.message : String(e));
  }
  await prisma.log.create({
    data: { logCode: await newId("LG"), type, toEmail: to, subject, status, relatedId, triggeredBy },
  });
  return status;
}

export async function sendVerifyEmail(user: { name: string; email: string }, token: string, triggeredBy: string) {
  const link = `${APP_URL}/api/auth/verify?token=${token}`;
  const html = `<div style="font-family:Arial;font-size:14px;line-height:1.6;">
    <h2 style="color:#0b5394;">Bliss Rooms — 邮箱验证 Email Verification</h2>
    <p>你好 ${user.name},</p>
    <p>请点击下面的按钮验证你的邮箱 / Please click to verify your email:</p>
    <p><a href="${link}" style="background:#0b5394;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">✅ 验证邮箱 Verify Email</a></p>
    <p style="color:#888;font-size:12px;">若按钮无效, 复制此链接: ${link}</p>
    <p style="color:#888;font-size:12px;">Bliss Rooms Enterprise</p></div>`;
  return send(user.email, "Bliss Rooms — 请验证你的邮箱 Verify Your Email", html, "VerifyEmail", user.email, triggeredBy);
}

export async function sendResetEmail(user: { name: string; email: string }, token: string) {
  const link = `${APP_URL}/reset-password?token=${token}`;
  const html = `<div style="font-family:Arial;font-size:14px;line-height:1.6;">
    <h2 style="color:#0b5394;">Bliss Rooms — 重设密码 Reset Password</h2>
    <p>你好 ${user.name},</p>
    <p>点击下面按钮重设密码 (1小时内有效) / Click to reset your password (valid 1 hour):</p>
    <p><a href="${link}" style="background:#0b5394;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">🔑 重设密码 Reset Password</a></p>
    <p style="color:#888;font-size:12px;">若不是你本人操作, 请忽略此邮件。</p></div>`;
  return send(user.email, "Bliss Rooms — 重设密码 Reset Password", html, "ResetPassword", user.email, "system");
}
