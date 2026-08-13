import { Resend } from "resend";
import { prisma } from "@/lib/prisma";
import { newId } from "@/lib/id";
import { PAYMENT_TYPE_LABELS } from "@/lib/config";

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

function wrap(title: string, bodyHtml: string) {
  return `<div style="font-family:Arial;font-size:14px;line-height:1.6;">
    <h2 style="color:#0b5394;">Bliss Rooms — ${title}</h2>
    ${bodyHtml}
    <p style="color:#888;font-size:12px;">Bliss Rooms Enterprise</p></div>`;
}

function typeLabel(type: string) {
  return PAYMENT_TYPE_LABELS[type] ?? type;
}

interface BillInfo {
  paymentCode: string;
  contractCode: string;
  roomCode: string;
  type: string;
  amountDue: number;
  amountPaid: number;
  dueDate?: string | null;
  periodMonth?: string | null;
}

/** Fires whenever a tenant uploads a slip — every ACTIVE Admin gets pinged to go review it. */
export async function notifyAdminsSlipUploaded(bill: BillInfo, tenantName: string, triggeredBy: string) {
  const admins = await prisma.user.findMany({ where: { role: "ADMIN", status: "ACTIVE" }, select: { name: true, email: true } });
  const link = `${APP_URL}/payments/review`;
  const html = wrap(
    "有新水单待审核 Slip Pending Review",
    `<p>${tenantName} 上传了一笔水单，等待审核：</p>
     <p><b>${bill.contractCode}</b> · ${bill.roomCode} · ${typeLabel(bill.type)} · RM${bill.amountPaid}</p>
     <p><a href="${link}" style="background:#0b5394;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">前往审核</a></p>`
  );
  const subject = `Bliss Rooms — 待审核: ${bill.contractCode} ${typeLabel(bill.type)} RM${bill.amountPaid}`;
  return Promise.all(admins.map((a) => send(a.email, subject, html, "SlipUploaded", bill.paymentCode, triggeredBy)));
}

/** Admin issues a new bill (rent due, utility bill, etc.) — tells the tenant to pay & upload proof. */
export async function notifyTenantBillCreated(tenant: { name: string; email: string }, bill: BillInfo, triggeredBy: string) {
  const html = wrap(
    "新账单 New Bill",
    `<p>你好 ${tenant.name},</p>
     <p>你有一笔新账单，请尽快付款并上传水单：</p>
     <p><b>${typeLabel(bill.type)}</b> · RM${bill.amountDue}${bill.periodMonth ? ` · ${bill.periodMonth}` : ""}</p>
     <p>到期日: ${bill.dueDate ? bill.dueDate.slice(0, 10) : "-"}</p>
     <p style="color:#c0392b;">逾期未上传水单将按 RM30/天 计迟交罚款。</p>
     <p><a href="${APP_URL}/my-tenancy" style="background:#0b5394;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">上传水单</a></p>`
  );
  return send(tenant.email, `Bliss Rooms — 新账单: ${typeLabel(bill.type)} RM${bill.amountDue}`, html, "BillCreated", bill.paymentCode, triggeredBy);
}

/** Admin approves or rejects an uploaded slip — tenant gets told either way. */
export async function notifyTenantBillReviewed(
  tenant: { name: string; email: string },
  bill: BillInfo,
  approved: boolean,
  reason: string | null,
  triggeredBy: string
) {
  const label = approved ? (bill.type === "AC" ? "已充值 Topped Up" : "已批准 Approved") : "已拒绝 Rejected";
  const html = wrap(
    `账单${approved ? "已批准" : "被拒绝"} Bill ${approved ? "Approved" : "Rejected"}`,
    `<p>你好 ${tenant.name},</p>
     <p>你的账单 <b>${typeLabel(bill.type)} RM${bill.amountPaid}</b> ${label}。</p>
     ${!approved ? `<p style="color:#c0392b;">原因: ${reason}</p><p>请重新上传正确的水单。</p>` : ""}
     <p><a href="${APP_URL}/my-tenancy" style="background:#0b5394;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">查看我的租约</a></p>`
  );
  return send(
    tenant.email,
    `Bliss Rooms — 账单${approved ? "已批准" : "被拒绝"}: ${typeLabel(bill.type)}`,
    html,
    "BillReviewed",
    bill.paymentCode,
    triggeredBy
  );
}

/** Cron-generated late fee — lets the tenant know a penalty was charged and why. */
export async function notifyTenantLateFee(tenant: { name: string; email: string }, bill: BillInfo, originalType: string) {
  const html = wrap(
    "迟交罚款 Late Payment Penalty",
    `<p>你好 ${tenant.name},</p>
     <p>你的 <b>${typeLabel(originalType)}</b> 账单逾期未付, 已产生迟交罚款 RM${bill.amountDue}。</p>
     <p>迟交罚款会按每天累计, 请尽快上传原账单和罚款的水单以避免继续产生罚款。</p>
     <p><a href="${APP_URL}/my-tenancy" style="background:#c0392b;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">立即处理</a></p>`
  );
  return send(tenant.email, `Bliss Rooms — 迟交罚款 RM${bill.amountDue}`, html, "LateFee", bill.paymentCode, "system-cron");
}

/** Admin-triggered formal warning letter (House Rules violation, repeated lateness, etc.) — free-text body. */
export async function sendWarningLetter(
  tenant: { name: string; email: string },
  contractCode: string,
  message: string,
  triggeredBy: string
) {
  const html = wrap(
    "警告信 Warning Letter",
    `<p>${tenant.name} 你好,</p>
     <p>合同编号: <b>${contractCode}</b></p>
     <div style="border-left:3px solid #c0392b;padding:8px 14px;margin:12px 0;background:#fdf2f2;white-space:pre-wrap;">${message}</div>
     <p>如有疑问请联系 Admin。</p>`
  );
  return send(tenant.email, `Bliss Rooms — 警告信 Warning Letter (${contractCode})`, html, "WarningLetter", contractCode, triggeredBy);
}
