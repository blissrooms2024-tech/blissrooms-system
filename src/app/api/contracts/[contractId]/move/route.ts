import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { serialize } from "@/lib/serialize";
import { MOVE_ITEMS } from "@/lib/moveItems";
import { RULES } from "@/lib/config";
import { newId } from "@/lib/id";
import type { MoveType } from "@/generated/prisma/enums";

function typeToEnum(t: string | null): MoveType {
  return t === "MoveOut" ? "MOVE_OUT" : "MOVE_IN";
}

/** Deposit must be paid in full before the tenant can fill Move-in — Admin can still fill/edit
 * on the tenant's behalf regardless (see call sites: gate is skipped for non-tenant users). */
async function depositOutstanding(contractId: string, securityDeposit: unknown): Promise<number> {
  const paid = await prisma.payment.aggregate({
    where: { contractId, type: "DEPOSIT", status: "Paid" },
    _sum: { amountPaid: true },
  });
  return Math.max(Number(securityDeposit) - Number(paid._sum.amountPaid ?? 0), 0);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ contractId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ success: false, message: "请重新登录" }, { status: 401 });

  const { contractId } = await params;
  const typeParam = req.nextUrl.searchParams.get("type"); // "MoveIn" | "MoveOut"
  const type = typeToEnum(typeParam);

  const c = await prisma.contract.findUnique({ where: { contractCode: contractId } });
  if (!c) return NextResponse.json({ success: false, message: "找不到合同" }, { status: 404 });

  const isTenant = c.tenantId === user.sub;
  const isAdmin = user.role === "ADMIN";

  const forms = await prisma.moveInOutForm.findMany({
    where: { contractId: c.id, type },
    orderBy: { id: "asc" },
  });
  const form = forms.length ? forms[forms.length - 1] : null;
  const locked = !!form?.locked;

  let canFill = false;
  let reason = "";
  if (type === "MOVE_IN") {
    if (c.status !== "ACTIVE") reason = "合同签好生效后才能填 Move-in";
    else if (!isTenant && !isAdmin) reason = "只有租客本人或 Admin 可填";
    else if (isTenant && locked) reason = "表单已提交并锁定, 如需修改请联系 Admin 重新开放";
    else if (isTenant && (await depositOutstanding(c.id, c.securityDeposit)) > 0)
      reason = "请先缴清押金 (Deposit) 才能填写 Move-in Form";
    else canFill = true;
  } else {
    const days = c.expiredDate
      ? Math.ceil((new Date(c.expiredDate).getTime() - Date.now()) / (24 * 3600 * 1000))
      : 999;
    if (c.status !== "ACTIVE") reason = "合同要生效中才能填 Move-out";
    else if (days > RULES.MOVE_OUT_WINDOW_DAYS) reason = `到期前2星期才开放 (还有 ${days} 天到期)`;
    else if (!isTenant && !isAdmin) reason = "只有租客本人或 Admin 可填";
    else if (isTenant && locked) reason = "表单已提交并锁定, 如需修改请联系 Admin 重新开放";
    else canFill = true;
  }

  return NextResponse.json({
    success: true,
    canFill,
    reason,
    isAdmin,
    locked,
    contract: serialize({
      contractCode: c.contractCode,
      tenantName: c.tenantName,
      tenantIc: c.tenantIc,
      roomCode: (await prisma.room.findUnique({ where: { id: c.roomId } }))?.roomCode,
      moveInDate: c.moveInDate,
    }),
    hasForm: !!form,
    form: form
      ? serialize({
          formCode: form.formCode,
          moveInDate: form.moveInDate,
          formDate: form.formDate,
          notes: form.notes,
          photos: form.photos,
          conditions: form.conditions,
          remarks: form.remarks,
          submittedAt: form.submittedAt,
          locked: form.locked,
        })
      : null,
    items: MOVE_ITEMS,
  });
}

interface MovePayload {
  moveInDate?: string;
  notes?: string;
  photos: Record<string, string[]>;
  conditions: Record<string, string>;
  remarks: Record<string, string>;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ contractId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ success: false, message: "请重新登录" }, { status: 401 });

  const { contractId } = await params;
  const body = (await req.json().catch(() => null)) as (MovePayload & { type?: string }) | null;
  if (!body) return NextResponse.json({ success: false, message: "资料格式不对" }, { status: 400 });

  const type = typeToEnum(body.type ?? null);

  const c = await prisma.contract.findUnique({ where: { contractCode: contractId } });
  if (!c) return NextResponse.json({ success: false, message: "找不到合同" }, { status: 404 });

  const isTenant = c.tenantId === user.sub;
  if (!isTenant && user.role !== "ADMIN") {
    return NextResponse.json({ success: false, message: "没有权限" }, { status: 403 });
  }
  if (type === "MOVE_IN" && user.role === "TENANT" && (await depositOutstanding(c.id, c.securityDeposit)) > 0) {
    return NextResponse.json(
      { success: false, message: "请先缴清押金 (Deposit) 才能填写 Move-in Form" },
      { status: 403 }
    );
  }

  const photos = body.photos || {};
  const conditions = body.conditions || {};
  const missing: string[] = [];
  for (const it of MOVE_ITEMS) {
    if (!it.required) continue;
    const arr = photos[it.key] || [];
    if (arr.length < it.min) missing.push(`${it.label}(照片)`);
    if (!conditions[it.key]) missing.push(`${it.label}(好/坏)`);
  }
  if (missing.length) {
    return NextResponse.json(
      { success: false, message: "这些必填还没完成: " + missing.join("、") },
      { status: 400 }
    );
  }

  const existing = await prisma.moveInOutForm.findMany({
    where: { contractId: c.id, type },
    orderBy: { id: "asc" },
  });
  const latest = existing.length ? existing[existing.length - 1] : null;
  if (user.role === "TENANT" && latest?.locked) {
    return NextResponse.json(
      { success: false, message: "表单已提交并锁定, 如需修改请联系 Admin 重新开放" },
      { status: 403 }
    );
  }

  const now = new Date();
  const payload = {
    type,
    contractId: c.id,
    tenantId: c.tenantId,
    roomCode: (await prisma.room.findUnique({ where: { id: c.roomId } }))!.roomCode,
    moveInDate: body.moveInDate ? new Date(body.moveInDate) : c.moveInDate,
    formDate: now,
    photos,
    conditions,
    remarks: body.remarks || {},
    notes: body.notes || "",
    submittedAt: now,
    // Tenant submissions lock the form until Admin reopens it; Admin's own edits leave the
    // lock state untouched (so Admin editing on the tenant's behalf doesn't accidentally
    // relock/unlock anything).
    ...(user.role === "TENANT" ? { locked: true } : {}),
  };

  if (existing.length) {
    await prisma.moveInOutForm.update({ where: { id: existing[existing.length - 1].id }, data: payload });
  } else {
    await prisma.moveInOutForm.create({
      data: { ...payload, formCode: await newId("MF") },
    });
  }

  return NextResponse.json({
    success: true,
    message: `✅ ${type === "MOVE_IN" ? "Move-in" : "Move-out"} 表单已提交`,
  });
}
