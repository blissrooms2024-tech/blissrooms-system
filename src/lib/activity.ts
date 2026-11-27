import { after } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";

/**
 * Activity log ("谁在什么时间做了什么"). Every API route that changes data exports its handler
 * wrapped in withActivity(). After a successful response ({ success: true, message }) the
 * wrapper records who did it, the module, the main code in the URL and the success message
 * itself (which is already written for humans, e.g. "佣金已发放: RM300.00 (Ali)").
 * The DB write happens in after(), so it never slows down or breaks the request.
 */

/** Login/sign-up/password-reset flows: no session yet, or nothing worth recording. */
const SKIP_PATHS = new Set([
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/signup",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
]);

const AREAS: [RegExp, string][] = [
  [/^\/api\/claims/, "报销"],
  [/^\/api\/utilities/, "抄表开单"],
  [/^\/api\/meetings/, "会议记录"],
  [/^\/api\/todos/, "待办"],
  [/^\/api\/expenses/, "支出"],
  [/^\/api\/contracts\/[^/]+\/(bills|payments|collect-lump-sum|breakdown-pay-all|credit-balance|ac-topup)/, "收款/账单"],
  [/^\/api\/contracts\/[^/]+\/maintenance/, "报修"],
  [/^\/api\/contracts\/[^/]+\/warning-letter/, "警告信"],
  [/^\/api\/contracts\/[^/]+\/(move|move-out|move-out-notice)(\/|$)/, "入住/退房"],
  [/^\/api\/contracts\/[^/]+\/pay-commission/, "Agent 佣金"],
  [/^\/api\/contracts/, "合同"],
  [/^\/api\/payments/, "收款/账单"],
  [/^\/api\/(maintenance|worker\/maintenance)/, "报修"],
  [/^\/api\/properties\/[^/]+\/info\/(owner-rent|utilities\/[^/]+\/paid)/, "付款提醒"],
  [/^\/api\/properties\/[^/]+\/info\/cards/, "单位资料·门卡"],
  [/^\/api\/properties\/[^/]+\/info\/utilities/, "单位资料·水电网"],
  [/^\/api\/properties\/[^/]+\/info\/photos/, "单位资料·照片"],
  [/^\/api\/properties\/[^/]+\/info\/reveal/, "单位资料·查看密码"],
  [/^\/api\/properties\/[^/]+\/info/, "单位资料"],
  [/^\/api\/properties/, "楼盘"],
  [/^\/api\/rooms/, "房间"],
  [/^\/api\/users/, "用户"],
  [/^\/api\/tenants/, "租客"],
  [/^\/api\/vouchers/, "代金券"],
  [/^\/api\/profile/, "个人资料"],
  [/^\/api\/auth/, "账号"],
  [/^\/api\/admin/, "系统"],
];

export function areaOf(path: string): string {
  for (const [re, label] of AREAS) if (re.test(path)) return label;
  return "其他";
}

/** First code-like path segment: CT-0012, EX-0003, PXC, PXC-01, CL-0002 … (not cuid ids). */
export function targetOf(path: string): string | null {
  for (const raw of path.split("/")) {
    let seg = raw;
    try {
      seg = decodeURIComponent(raw);
    } catch {
      // keep raw
    }
    if (seg.length <= 24 && /^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*$/.test(seg)) return seg;
  }
  return null;
}

/** Success messages sometimes echo a new account's password — never store that. */
export function redact(text: string): string {
  return text.replace(/((?:登录)?密码)\s*[:：]\s*[^\s)）,，|]+/g, "$1: ••••••");
}

export function cleanSummary(message: string): string {
  return redact(message.replace(/^\s*✅\s*/, "").trim()).slice(0, 500);
}

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

async function record(req: Request, res: Response) {
  const method = req.method.toUpperCase();
  if (!MUTATING.has(method) || !res.ok) return;
  const path = new URL(req.url).pathname;
  if (SKIP_PATHS.has(path)) return;
  if (!(res.headers.get("content-type") ?? "").includes("application/json")) return;

  const body = (await res
    .clone()
    .json()
    .catch(() => null)) as { success?: unknown; message?: unknown } | null;
  if (!body || body.success !== true || typeof body.message !== "string" || !body.message.trim()) return;

  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session) return;

  const data = {
    userId: session.sub,
    userName: session.name,
    role: session.role,
    method,
    path,
    area: areaOf(path),
    target: targetOf(path),
    summary: cleanSummary(body.message),
  };
  after(async () => {
    try {
      await prisma.activityLog.create({ data });
    } catch (e) {
      console.error("[activity] failed to record", e);
    }
  });
}

/** Wraps a route handler so its successful changes land in the activity log. */
export function withActivity<H extends (...args: never[]) => Promise<Response>>(handler: H): H {
  const wrapped = async (...args: never[]) => {
    const res = await handler(...args);
    try {
      const req = args[0] as unknown as Request | undefined;
      if (req && typeof req.url === "string") await record(req, res);
    } catch (e) {
      console.error("[activity] skipped", e);
    }
    return res;
  };
  return wrapped as unknown as H;
}
