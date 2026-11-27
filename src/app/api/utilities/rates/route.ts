import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { withActivity } from "@/lib/activity";
import { getRates, setRates } from "@/lib/utilityBilling";

const rate = z.coerce.number().min(0).max(10);
const schema = z.object({ ELECTRIC: rate, LAUNDRY: rate, AC: rate });

/** PUT /api/utilities/rates — RM per kWh for electricity, washer + dryer and aircon (Admin).
 * Only bills issued after the change use the new rates. */
async function handlePUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ success: false, message: "只有 Admin 可以改单价" }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, message: "单价要是 0 到 10 之间的数字" }, { status: 400 });
  await setRates(parsed.data, user.name);
  const r = await getRates();
  return NextResponse.json({
    success: true,
    message: `单价已更新：电费 RM${r.ELECTRIC.toFixed(2)}、洗衣烘干 RM${r.LAUNDRY.toFixed(2)}、冷气 RM${r.AC.toFixed(2)} 一度`,
    rates: r,
  });
}

export const PUT = withActivity(handlePUT);
