import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { RULES } from "@/lib/config";
import { notifyTenantAccountDisabledExpired, notifyAdminsTenantDisabledExpired } from "@/lib/mail";

/** Vercel Cron hits this daily. A TENANT whose every ACTIVE contract's expiredDate is more
 * than RULES.LEASE_EXPIRY_GRACE_DAYS days in the past (giving Admin/tenant a few days to
 * renew or sort things out) gets their login disabled — getCurrentUser() already refuses
 * any session whose User.status isn't ACTIVE, so this takes effect immediately. A tenant
 * with at least one ACTIVE contract that isn't past the grace cutoff yet is left alone, so a
 * tenant mid-renewal on one unit doesn't get locked out over an unrelated expired one. This
 * only ever disables — re-enabling is always a manual Admin action via the Users page's
 * existing 启用/停用 toggle, so it never undoes a deliberate Admin decision. Scoped to role
 * TENANT only: an Agent who's also the tenant on their own contract keeps their agent login
 * regardless of that contract's status. */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ success: false, message: "unauthorized" }, { status: 401 });
  }

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const cutoff = new Date(startOfToday.getTime() - RULES.LEASE_EXPIRY_GRACE_DAYS * 24 * 3600 * 1000);

  const tenants = await prisma.user.findMany({
    where: { role: "TENANT", status: "ACTIVE" },
    include: {
      contractsAsTenant: { where: { status: "ACTIVE" }, select: { contractCode: true, expiredDate: true } },
    },
  });

  let disabled = 0;
  const details: string[] = [];

  for (const tenant of tenants) {
    const activeContracts = tenant.contractsAsTenant;
    if (activeContracts.length === 0) continue; // nothing to judge by — leave untouched

    const hasContractStillWithinGrace = activeContracts.some(
      (c) => !c.expiredDate || c.expiredDate >= cutoff
    );
    if (hasContractStillWithinGrace) continue;

    const contractCodes = activeContracts.map((c) => c.contractCode);
    await prisma.user.update({ where: { id: tenant.id }, data: { status: "DISABLED" } });
    await notifyTenantAccountDisabledExpired(tenant, contractCodes);
    await notifyAdminsTenantDisabledExpired(tenant, contractCodes);
    disabled++;
    details.push(`${tenant.name} (${contractCodes.join(", ")})`);
  }

  return NextResponse.json({ success: true, disabled, details });
}
