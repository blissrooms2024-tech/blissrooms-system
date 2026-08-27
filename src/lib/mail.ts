import { Resend } from "resend";
import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";
import { newId } from "@/lib/id";

// English labels for email content — the in-app UI stays Chinese (see lib/config.ts), but
// all outbound email is English-only.
const PAYMENT_TYPE_LABELS_EN: Record<string, string> = {
  DEPOSIT: "Deposit",
  UTILITIES: "Utilities Deposit",
  RENTAL: "Rental",
  ADMIN_FEE: "Admin Fee",
  ACCESS_CARD: "Access Card Deposit",
  AC: "Air-Cond Top-Up",
  DRYER: "Dryer",
  LATE_FEE: "Late Payment Penalty",
  OTHER: "Other",
};

const MAINTENANCE_STATUS_LABELS_EN: Record<string, string> = {
  SUBMITTED: "Submitted",
  ACKNOWLEDGED: "Acknowledged",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

// Falls back to Vercel's own auto-provided deployment URL when NEXT_PUBLIC_APP_URL isn't
// set, so email links never silently point at localhost in production.
const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

// Gmail SMTP is preferred when configured: unlike Resend's default onboarding@resend.dev
// sender, a real Gmail account can actually deliver to any recipient without needing a
// verified custom domain — no domain purchase required. Falls back to Resend, then to a
// console.log-only dev stub if neither is configured.
const gmailUser = process.env.GMAIL_USER;
const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;
const gmailTransport =
  gmailUser && gmailAppPassword
    ? nodemailer.createTransport({
        service: "gmail",
        auth: { user: gmailUser, pass: gmailAppPassword },
      })
    : null;

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const RESEND_FROM = process.env.EMAIL_FROM || "Bliss Rooms <onboarding@resend.dev>";

async function send(to: string, subject: string, html: string, type: string, relatedId: string, triggeredBy: string) {
  let status = "sent";
  try {
    if (gmailTransport) {
      await gmailTransport.sendMail({ from: `Bliss Rooms <${gmailUser}>`, to, subject, html });
    } else if (resend) {
      await resend.emails.send({ from: RESEND_FROM, to, subject, html });
    } else {
      // No mail provider configured yet — log instead of throwing, so local dev keeps working.
      console.log(`[mail:${type}] (no mail provider configured, not actually sent) to=${to} subject=${subject}`);
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
    <h2 style="color:#0b5394;">Bliss Rooms — Email Verification</h2>
    <p>Hi ${user.name},</p>
    <p>Please click the button below to verify your email:</p>
    <p><a href="${link}" style="background:#0b5394;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">✅ Verify Email</a></p>
    <p style="color:#888;font-size:12px;">If the button doesn't work, copy this link: ${link}</p>
    <p style="color:#888;font-size:12px;">Bliss Rooms Enterprise</p></div>`;
  return send(user.email, "Bliss Rooms — Please Verify Your Email", html, "VerifyEmail", user.email, triggeredBy);
}

export async function sendResetEmail(user: { name: string; email: string }, token: string) {
  const link = `${APP_URL}/reset-password?token=${token}`;
  const html = `<div style="font-family:Arial;font-size:14px;line-height:1.6;">
    <h2 style="color:#0b5394;">Bliss Rooms — Reset Password</h2>
    <p>Hi ${user.name},</p>
    <p>Click the button below to reset your password (valid for 1 hour):</p>
    <p><a href="${link}" style="background:#0b5394;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">🔑 Reset Password</a></p>
    <p style="color:#888;font-size:12px;">If you didn't request this, please ignore this email.</p></div>`;
  return send(user.email, "Bliss Rooms — Reset Password", html, "ResetPassword", user.email, "system");
}

function wrap(title: string, bodyHtml: string) {
  return `<div style="font-family:Arial;font-size:14px;line-height:1.6;">
    <h2 style="color:#0b5394;">Bliss Rooms — ${title}</h2>
    ${bodyHtml}
    <p style="color:#888;font-size:12px;">Bliss Rooms Enterprise</p></div>`;
}

function typeLabel(type: string) {
  return PAYMENT_TYPE_LABELS_EN[type] ?? type;
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
    "New Slip Pending Review",
    `<p>${tenantName} uploaded a payment slip that needs review:</p>
     <p><b>${bill.contractCode}</b> · ${bill.roomCode} · ${typeLabel(bill.type)} · RM${bill.amountPaid}</p>
     <p><a href="${link}" style="background:#0b5394;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">Go Review</a></p>`
  );
  const subject = `Bliss Rooms — Pending Review: ${bill.contractCode} ${typeLabel(bill.type)} RM${bill.amountPaid}`;
  return Promise.all(admins.map((a) => send(a.email, subject, html, "SlipUploaded", bill.paymentCode, triggeredBy)));
}

/** Admin issues a new bill (rent due, utility bill, etc.) — tells the tenant to pay & upload proof. */
export async function notifyTenantBillCreated(tenant: { name: string; email: string }, bill: BillInfo, triggeredBy: string) {
  const html = wrap(
    "New Bill",
    `<p>Hi ${tenant.name},</p>
     <p>You have a new bill. Please pay and upload your payment slip as soon as possible:</p>
     <p><b>${typeLabel(bill.type)}</b> · RM${bill.amountDue}${bill.periodMonth ? ` · ${bill.periodMonth}` : ""}</p>
     <p>Due date: ${bill.dueDate ? bill.dueDate.slice(0, 10) : "-"}</p>
     <p style="color:#c0392b;">A late payment penalty of RM30/day applies if the slip isn't uploaded by the due date.</p>
     <p><a href="${APP_URL}/my-tenancy" style="background:#0b5394;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">Upload Slip</a></p>`
  );
  return send(tenant.email, `Bliss Rooms — New Bill: ${typeLabel(bill.type)} RM${bill.amountDue}`, html, "BillCreated", bill.paymentCode, triggeredBy);
}

/** Admin approves or rejects an uploaded slip — tenant gets told either way. */
export async function notifyTenantBillReviewed(
  tenant: { name: string; email: string },
  bill: BillInfo,
  approved: boolean,
  reason: string | null,
  triggeredBy: string
) {
  const label = approved ? (bill.type === "AC" ? "Topped Up" : "Approved") : "Rejected";
  const html = wrap(
    `Bill ${approved ? "Approved" : "Rejected"}`,
    `<p>Hi ${tenant.name},</p>
     <p>Your bill <b>${typeLabel(bill.type)} RM${bill.amountPaid}</b> has been ${label}.</p>
     ${!approved ? `<p style="color:#c0392b;">Reason: ${reason}</p><p>Please re-upload the correct payment slip.</p>` : ""}
     <p><a href="${APP_URL}/my-tenancy" style="background:#0b5394;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">View My Tenancy</a></p>`
  );
  return send(
    tenant.email,
    `Bliss Rooms — Bill ${approved ? "Approved" : "Rejected"}: ${typeLabel(bill.type)}`,
    html,
    "BillReviewed",
    bill.paymentCode,
    triggeredBy
  );
}

/** Cron-generated late fee — lets the tenant know a penalty was charged and why. */
export async function notifyTenantLateFee(tenant: { name: string; email: string }, bill: BillInfo, originalType: string) {
  const html = wrap(
    "Late Payment Penalty",
    `<p>Hi ${tenant.name},</p>
     <p>Your <b>${typeLabel(originalType)}</b> bill is overdue, so a late payment penalty of RM${bill.amountDue} has been charged.</p>
     <p>This penalty accrues daily — please upload the payment slip for the original bill and the penalty as soon as possible to avoid further charges.</p>
     <p><a href="${APP_URL}/my-tenancy" style="background:#c0392b;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">Handle Now</a></p>`
  );
  return send(tenant.email, `Bliss Rooms — Late Payment Penalty RM${bill.amountDue}`, html, "LateFee", bill.paymentCode, "system-cron");
}

/** Admin-triggered formal warning letter (House Rules violation, repeated lateness, etc.) — free-text body. */
export async function sendWarningLetter(
  tenant: { name: string; email: string },
  contractCode: string,
  message: string,
  triggeredBy: string
) {
  const html = wrap(
    "Warning Letter",
    `<p>Hi ${tenant.name},</p>
     <p>Contract: <b>${contractCode}</b></p>
     <div style="border-left:3px solid #c0392b;padding:8px 14px;margin:12px 0;background:#fdf2f2;white-space:pre-wrap;">${message}</div>
     <p>Please contact Admin if you have any questions.</p>`
  );
  return send(tenant.email, `Bliss Rooms — Warning Letter (${contractCode})`, html, "WarningLetter", contractCode, triggeredBy);
}

interface MaintenanceInfo {
  requestCode: string;
  contractCode: string;
  roomCode: string;
  title: string;
  status: string;
}

/** Tenant submits a repair/maintenance request — every ACTIVE Admin gets pinged to review it. */
export async function notifyAdminsMaintenanceSubmitted(req: MaintenanceInfo, tenantName: string, triggeredBy: string) {
  const admins = await prisma.user.findMany({ where: { role: "ADMIN", status: "ACTIVE" }, select: { name: true, email: true } });
  const link = `${APP_URL}/maintenance`;
  const html = wrap(
    "New Maintenance Request",
    `<p>${tenantName} submitted a maintenance request:</p>
     <p>Room: <b>${req.roomCode}</b> (${req.contractCode})<br/>Title: <b>${req.title}</b></p>
     <p><a href="${link}" style="background:#0b5394;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">Go Handle It</a></p>`
  );
  return Promise.all(
    admins.map((a) => send(a.email, `Bliss Rooms — New Maintenance Request: ${req.title}`, html, "MaintenanceSubmitted", req.requestCode, triggeredBy))
  );
}

/** Admin updates a maintenance request's status — tenant gets told. */
export async function notifyTenantMaintenanceUpdated(
  tenant: { name: string; email: string },
  req: MaintenanceInfo,
  triggeredBy: string
) {
  const label = MAINTENANCE_STATUS_LABELS_EN[req.status] ?? req.status;
  const html = wrap(
    "Maintenance Update",
    `<p>Hi ${tenant.name},</p>
     <p>Your maintenance request <b>${req.title}</b> (${req.roomCode}) status has been updated to: <b>${label}</b></p>
     <p><a href="${APP_URL}/my-tenancy" style="background:#0b5394;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">View Details</a></p>`
  );
  return send(tenant.email, `Bliss Rooms — Maintenance Update: ${label}`, html, "MaintenanceUpdated", req.requestCode, triggeredBy);
}

/** Rent arrears cross the escalation threshold (default day 10) — every ACTIVE Admin gets told
 * this contract needs a manual decision on terminating the contract and forfeiting the deposit.
 * This is deliberately notify-only: the system never executes that itself. */
export async function notifyAdminsRentEscalation(
  bill: BillInfo,
  contractCode: string,
  tenantName: string,
  daysOverdue: number
) {
  const admins = await prisma.user.findMany({ where: { role: "ADMIN", status: "ACTIVE" }, select: { name: true, email: true } });
  const link = `${APP_URL}/contracts`;
  const html = wrap(
    "Rent Arrears — Action Needed",
    `<p><b>${tenantName}</b> (Contract <b>${contractCode}</b>, Room ${bill.roomCode}) has rent overdue by <b>${daysOverdue} days</b>.</p>
     <p>This has crossed the company policy threshold — please review whether to terminate the contract and forfeit the deposit. The system will not do this automatically; it requires manual confirmation from Admin on the contracts page.</p>
     <p><a href="${link}" style="background:#c0392b;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">Go Handle It</a></p>`
  );
  return Promise.all(
    admins.map((a) =>
      send(a.email, `Bliss Rooms — ${contractCode} Rent Overdue ${daysOverdue} Days, Action Needed`, html, "RentEscalation", bill.paymentCode, "system-cron")
    )
  );
}

/** Admin manually confirms terminating a contract for rent arrears (deposit forfeited). */
export async function notifyTenantContractTerminated(
  tenant: { name: string; email: string },
  contractCode: string,
  triggeredBy: string
) {
  const html = wrap(
    "Contract Terminated",
    `<p>Hi ${tenant.name},</p>
     <p>Due to prolonged unpaid rent, your contract <b>${contractCode}</b> has been terminated, and the deposit has been forfeited as compensation for the outstanding amount/breach of contract.</p>
     <p>Please contact Admin as soon as possible to arrange your move-out.</p>`
  );
  return send(tenant.email, `Bliss Rooms — Contract Terminated (${contractCode})`, html, "ContractTerminated", contractCode, triggeredBy);
}
