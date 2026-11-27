import { after, NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { withActivity } from "@/lib/activity";
import { notifyTenantUtilityBills } from "@/lib/mail";
import { BillingError, findUnit, issueRun } from "@/lib/utilityBilling";
import { runSchema } from "@/lib/utilitySchemas";
import { KIND_LABELS } from "@/lib/utilitySplit";

/** POST /api/utilities/PXC/runs — issue a month's usage bills for the unit (Admin): saves the
 * readings, creates each tenant's bills, emails every tenant their own breakdown, and returns a
 * message ready for the unit's WhatsApp group. */
async function handlePOST(req: NextRequest, { params }: { params: Promise<{ propertyCode: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ success: false, message: "只有 Admin 可以开账单" }, { status: 403 });
  const { propertyCode } = await params;
  const unit = await findUnit(propertyCode);
  if (!unit) return NextResponse.json({ success: false, message: "找不到这个单位" }, { status: 404 });
  const parsed = runSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, message: "资料不完整，请检查读数和付款期限" }, { status: 400 });
  const d = parsed.data;

  let out: Awaited<ReturnType<typeof issueRun>>;
  try {
    out = await issueRun({ unit, period: d.period, splitBy: d.splitBy, dueDate: d.dueDate, inputs: d.inputs, overrides: d.overrides, skip: d.skip, by: user.name });
  } catch (e) {
    if (e instanceof BillingError) return NextResponse.json({ success: false, message: e.message }, { status: 400 });
    throw e;
  }

  const tenantIds = out.perTenant.map((p) => p.tenancy.tenantId).filter((x): x is string => !!x);
  const users = await prisma.user.findMany({ where: { id: { in: tenantIds } }, select: { id: true, name: true, email: true } });
  const byId = new Map(users.map((u) => [u.id, u]));
  const noEmail = out.perTenant.filter((p) => !p.tenancy.tenantId || !byId.get(p.tenancy.tenantId)?.email).map((p) => p.tenancy.roomCode);
  after(async () => {
    for (const p of out.perTenant) {
      const tenant = p.tenancy.tenantId ? byId.get(p.tenancy.tenantId) : null;
      if (!tenant?.email) continue;
      await notifyTenantUtilityBills(
        tenant,
        {
          period: d.period,
          roomCode: p.tenancy.roomCode,
          dueDate: d.dueDate,
          runCode: out.run.runCode,
          lines: p.lines.map((l) => ({ label: KIND_LABELS[l.kind].en, amount: l.amount, note: l.note })),
        },
        user.name
      );
    }
  });

  const n = out.final.bills.length;
  const people = out.perTenant.length;
  const company = out.final.company > 0 ? `，公司承担 RM${out.final.company.toFixed(2)}` : "";
  const missing = noEmail.length ? `（${noEmail.join("、")} 没有租客账号，收不到 email）` : "";
  return NextResponse.json({
    success: true,
    message: `${unit.propertyCode} ${d.period} 已开 ${n} 张账单给 ${people} 位租客，共 RM${out.final.billed.toFixed(2)}${company}${missing}`,
    runCode: out.run.runCode,
    whatsapp: out.whatsapp,
  });
}

export const POST = withActivity(handlePOST);
