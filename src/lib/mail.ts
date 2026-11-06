import { Resend } from "resend";
import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";
import { newId } from "@/lib/id";
import { fmtDate } from "@/lib/format";

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
  PENDING_REVIEW: "Pending Review",
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

function wrap(title: string, bodyHtml: string, accentColor = "#0b5394") {
  return `<div style="font-family:Arial;font-size:14px;line-height:1.6;">
    <h2 style="color:${accentColor};">Bliss Rooms — ${title}</h2>
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
  // Aircon top-ups block the tenant's AC immediately, so flag these orange to catch Admin's
  // eye in the inbox and get handled faster than an ordinary slip review.
  const isAcTopup = bill.type === "AC";
  const accentColor = isAcTopup ? "#e67e22" : "#0b5394";
  const html = wrap(
    "New Transaction Slip Pending Review",
    `<p>${tenantName} uploaded a transaction slip that needs review:</p>
     <p><b style="${isAcTopup ? `color:${accentColor};` : ""}">${bill.contractCode}</b> · ${bill.roomCode} · ${typeLabel(bill.type)} · RM${bill.amountPaid.toFixed(2)}</p>
     <p><a href="${link}" style="background:${accentColor};color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">Go Review</a></p>`,
    accentColor
  );
  const subject = `${isAcTopup ? "🟠 " : ""}Bliss Rooms — Pending Review: ${bill.contractCode} ${typeLabel(bill.type)} RM${bill.amountPaid.toFixed(2)}`;
  return Promise.all(admins.map((a) => send(a.email, subject, html, "SlipUploaded", bill.paymentCode, triggeredBy)));
}

/** Admin issues a new bill (rent due, utility bill, etc.) — tells the tenant to pay & upload proof. */
export async function notifyTenantBillCreated(tenant: { name: string; email: string }, bill: BillInfo, triggeredBy: string) {
  const html = wrap(
    "New Bill",
    `<p>Hi ${tenant.name},</p>
     <p>You have a new bill. Please pay and upload your transaction slip as soon as possible:</p>
     <p><b>${typeLabel(bill.type)}</b> · RM${bill.amountDue.toFixed(2)}${bill.periodMonth ? ` · ${bill.periodMonth}` : ""}</p>
     <p>Due date: ${fmtDate(bill.dueDate)}</p>
     <p style="color:#c0392b;">A late payment penalty of RM30.00/day applies if the transaction slip isn't uploaded by the due date.</p>
     <p><a href="${APP_URL}/my-tenancy" style="background:#0b5394;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">Upload Transaction Slip</a></p>`
  );
  return send(tenant.email, `Bliss Rooms — New Bill: ${typeLabel(bill.type)} RM${bill.amountDue.toFixed(2)}`, html, "BillCreated", bill.paymentCode, triggeredBy);
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
     <p>Your bill <b>${typeLabel(bill.type)} RM${bill.amountPaid.toFixed(2)}</b> has been ${label}.</p>
     ${!approved ? `<p style="color:#c0392b;">Reason: ${reason}</p><p>Please re-upload the correct transaction slip.</p>` : ""}
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
     <p>Your <b>${typeLabel(originalType)}</b> bill is overdue, so a late payment penalty of RM${bill.amountDue.toFixed(2)} has been charged.</p>
     <p>This penalty accrues daily — please upload the transaction slip for the original bill and the penalty as soon as possible to avoid further charges.</p>
     <p><a href="${APP_URL}/my-tenancy" style="background:#c0392b;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">Handle Now</a></p>`
  );
  return send(tenant.email, `Bliss Rooms — Late Payment Penalty RM${bill.amountDue.toFixed(2)}`, html, "LateFee", bill.paymentCode, "system-cron");
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

/** In-house worker submits their after-photos as done — every ACTIVE Admin gets pinged to check
 * the work and close it out with a cost. */
export async function notifyAdminsMaintenanceWorkerSubmitted(req: MaintenanceInfo, workerName: string, triggeredBy: string) {
  const admins = await prisma.user.findMany({ where: { role: "ADMIN", status: "ACTIVE" }, select: { name: true, email: true } });
  const link = `${APP_URL}/maintenance`;
  const html = wrap(
    "Maintenance Job Submitted for Review",
    `<p>${workerName} finished a repair job and submitted it for review:</p>
     <p>Room: <b>${req.roomCode}</b> (${req.contractCode})<br/>Title: <b>${req.title}</b></p>
     <p><a href="${link}" style="background:#0b5394;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">Go Review It</a></p>`
  );
  return Promise.all(
    admins.map((a) => send(a.email, `Bliss Rooms — Job Ready for Review: ${req.title}`, html, "MaintenanceWorkerSubmitted", req.requestCode, triggeredBy))
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
     <p><a href="${APP_URL}/my-maintenance" style="background:#0b5394;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">View Details</a></p>`
  );
  return send(tenant.email, `Bliss Rooms — Maintenance Update: ${label}`, html, "MaintenanceUpdated", req.requestCode, triggeredBy);
}

/** Admin leaves a remark on an open request (e.g. explaining a delay) without necessarily
 * changing its status — tenant gets told so they're not left guessing why nothing's moving. */
export async function notifyTenantMaintenanceNoteAdded(
  tenant: { name: string; email: string },
  req: MaintenanceInfo,
  note: string,
  triggeredBy: string
) {
  const html = wrap(
    "Maintenance Update",
    `<p>Hi ${tenant.name},</p>
     <p>A note was added to your maintenance request <b>${req.title}</b> (${req.roomCode}):</p>
     <p style="background:#fff8e1;padding:10px 14px;border-radius:6px;">${note}</p>
     <p><a href="${APP_URL}/my-maintenance" style="background:#0b5394;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">View Details</a></p>`
  );
  return send(tenant.email, `Bliss Rooms — Maintenance Update: ${req.title}`, html, "MaintenanceNoteAdded", req.requestCode, triggeredBy);
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

/** Cron auto-disabled a tenant's login because every contract they're on has been expired
 * past the grace period with no renewal — tells the tenant why, and how to get it back. */
export async function notifyTenantAccountDisabledExpired(tenant: { name: string; email: string }, contractCodes: string[]) {
  const html = wrap(
    "Account Disabled — Lease Expired",
    `<p>Hi ${tenant.name},</p>
     <p>Your lease (${contractCodes.join(", ")}) has expired and the grace period has passed, so your account login has been disabled.</p>
     <p>If you're renewing, or need more time, please contact Admin as soon as possible to have your account reactivated.</p>`,
    "#c0392b"
  );
  return send(
    tenant.email,
    "Bliss Rooms — Account Disabled (Lease Expired)",
    html,
    "AccountDisabledExpired",
    contractCodes[0] ?? "",
    "system-cron"
  );
}

/** Same event, to every ACTIVE Admin — so it's visible and reversible (via the Users page's
 * 启用/停用 toggle) if it was premature, e.g. a renewal that hasn't been entered yet. */
export async function notifyAdminsTenantDisabledExpired(tenant: { name: string; userCode: string }, contractCodes: string[]) {
  const admins = await prisma.user.findMany({ where: { role: "ADMIN", status: "ACTIVE" }, select: { name: true, email: true } });
  const link = `${APP_URL}/users`;
  const html = wrap(
    "Tenant Account Auto-Disabled — Lease Expired",
    `<p><b>${tenant.name}</b>'s account has been automatically disabled: every contract they're on (${contractCodes.join(", ")}) expired more than the grace period ago with no renewal on file.</p>
     <p>If this was a mistake (e.g. renewal not yet entered), you can re-enable the account on the Users page.</p>
     <p><a href="${link}" style="background:#c0392b;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">Go to Users</a></p>`
  );
  return Promise.all(
    admins.map((a) =>
      send(a.email, `Bliss Rooms — ${tenant.name} Auto-Disabled (Lease Expired)`, html, "TenantDisabledExpired", tenant.userCode, "system-cron")
    )
  );
}

/** Cron found one or more ACTIVE contracts that just entered the renewal notice window
 * (or are already past expiry) without having been renewed yet — one digest email per day
 * covering only the contracts newly flagged that run, so Admin isn't re-sent the same list
 * every day for the whole notice window. */
export async function notifyAdminsRenewalReminder(
  contracts: { contractCode: string; tenantName: string; roomCode: string; expiredDate: string | null; daysToExpiry: number | null }[]
) {
  const admins = await prisma.user.findMany({ where: { role: "ADMIN", status: "ACTIVE" }, select: { name: true, email: true } });
  const link = `${APP_URL}/contracts/renewal`;
  const rows = contracts
    .map((c) => {
      const status = c.daysToExpiry !== null && c.daysToExpiry < 0 ? `${-c.daysToExpiry} days overdue` : `${c.daysToExpiry} days left`;
      return `<li><b>${c.contractCode}</b> · ${c.roomCode} · ${c.tenantName} — expires ${fmtDate(c.expiredDate)} (${status})</li>`;
    })
    .join("");
  const html = wrap(
    "Contracts Need Renewal",
    `<p><b>${contracts.length}</b> contract(s) are approaching (or past) their expiry date and haven't been renewed yet:</p>
     <ul>${rows}</ul>
     <p><a href="${link}" style="background:#0b5394;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">Go to Renewals</a></p>`
  );
  return Promise.all(
    admins.map((a) =>
      send(a.email, `Bliss Rooms — ${contracts.length} Contract(s) Need Renewal`, html, "RenewalReminder", contracts[0]?.contractCode ?? "", "system-cron")
    )
  );
}

export async function notifyAdminsMoveOutNotice(
  contractCode: string,
  roomCode: string,
  tenantName: string,
  moveOutDate: string,
  triggeredBy: string
) {
  const admins = await prisma.user.findMany({ where: { role: "ADMIN", status: "ACTIVE" }, select: { name: true, email: true } });
  const link = `${APP_URL}/contracts/${contractCode}`;
  const html = wrap(
    "Tenant Won't Renew — Move-Out Notice",
    `<p><b>${tenantName}</b> (Contract <b>${contractCode}</b>, Room ${roomCode}) has given notice they will not be renewing and expect to move out on <b>${fmtDate(moveOutDate)}</b>.</p>
     <p>Please follow up to confirm and start re-marketing the room.</p>
     <p><a href="${link}" style="background:#7c3aed;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">View Contract</a></p>`
  );
  return Promise.all(
    admins.map((a) =>
      send(a.email, `Bliss Rooms — ${contractCode} Move-Out Notice`, html, "MoveOutNotice", contractCode, triggeredBy)
    )
  );
}

/** Best-effort local-to-international normalization for a Malaysian mobile number (the only
 * market this system serves) so a wa.me link actually opens the right chat — strips
 * formatting, and swaps a leading "0" for the "60" country code. Returns null when there's
 * nothing usable, since wa.me needs digits, not a guess. */
function toWhatsAppNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("0")) return "60" + digits.slice(1);
  if (digits.startsWith("60")) return digits;
  return digits;
}

export async function notifyAdminsRenewalRequested(
  contractCode: string,
  roomCode: string,
  tenantName: string,
  tenantPhone: string | null,
  months: number,
  triggeredBy: string
) {
  const admins = await prisma.user.findMany({ where: { role: "ADMIN", status: "ACTIVE" }, select: { name: true, email: true } });
  const link = `${APP_URL}/contracts/renewal`;
  const waNumber = toWhatsAppNumber(tenantPhone);
  const waText = encodeURIComponent(
    `Hi ${tenantName}, this is Bliss Rooms regarding your renewal request for ${contractCode} (${months} months). `
  );
  const waLink = waNumber ? `https://wa.me/${waNumber}?text=${waText}` : null;
  const html = wrap(
    "Tenant Requested Renewal",
    `<p><b>${tenantName}</b> (Contract <b>${contractCode}</b>, Room ${roomCode}) has requested to renew for <b>${months} months</b>.</p>
     <p>Please review and process on the 续约管理 (Renewal) page — the contract reserves your right to decline.</p>
     <p><a href="${link}" style="background:#7c3aed;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">Go to Renewal Page</a>${
      waLink
        ? ` &nbsp; <a href="${waLink}" style="background:#25d366;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">WhatsApp Tenant</a>`
        : ""
    }</p>`
  );
  return Promise.all(
    admins.map((a) =>
      send(a.email, `Bliss Rooms — ${contractCode} Renewal Requested (${months} months)`, html, "RenewalRequested", contractCode, triggeredBy)
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

/** An Agent self-registers — every ACTIVE Admin gets pinged to review and approve the account
 * before it can log in. */
export async function notifyAdminsAgentSignup(agent: { userCode: string; name: string; email: string }, triggeredBy: string) {
  const admins = await prisma.user.findMany({ where: { role: "ADMIN", status: "ACTIVE" }, select: { name: true, email: true } });
  const link = `${APP_URL}/users`;
  const html = wrap(
    "New Agent Signup Pending Approval",
    `<p>${agent.name} (${agent.email}) just signed up as an Agent and is waiting for approval before they can log in.</p>
     <p><a href="${link}" style="background:#0b5394;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">Review & Approve</a></p>`
  );
  return Promise.all(
    admins.map((a) => send(a.email, `Bliss Rooms — New Agent Signup: ${agent.name}`, html, "AgentSignup", agent.userCode, triggeredBy))
  );
}

/** Admin approves a pending Agent signup — the Agent gets told they can now log in. */
export async function notifyAgentApproved(agent: { userCode: string; name: string; email: string }, triggeredBy: string) {
  const html = wrap(
    "Account Approved",
    `<p>Hi ${agent.name},</p>
     <p>Your Agent account has been approved — you can now log in to Bliss Rooms.</p>
     <p><a href="${APP_URL}/login" style="background:#0b5394;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">Log In</a></p>`
  );
  return send(agent.email, "Bliss Rooms — Your Agent Account Has Been Approved", html, "AgentApproved", agent.userCode, triggeredBy);
}
