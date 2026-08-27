import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { uploadDataUrl } from "@/lib/storage";

const schema = z.object({
  slot: z.enum(["before", "after"]),
  dataUrl: z.string().min(1),
});

/** Worker uploads a before/after photo for their own assigned job. Uploading the first
 * "before" photo auto-moves an ACKNOWLEDGED job to IN_PROGRESS — a low-risk transition since
 * it doesn't touch money or the tenant relationship, just signals work has actually started. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "WORKER") {
    return NextResponse.json({ success: false, message: "只有维修工人可以上传" }, { status: 403 });
  }
  const { requestId } = await params;
  const reqRow = await prisma.maintenanceRequest.findUnique({ where: { requestCode: requestId } });
  if (!reqRow) return NextResponse.json({ success: false, message: "找不到这个报修单" }, { status: 404 });
  if (reqRow.assignedWorkerId !== user.sub) {
    return NextResponse.json({ success: false, message: "这个报修单不是指派给你的" }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "请先选图片" }, { status: 400 });
  }
  const d = parsed.data;

  const field = d.slot === "before" ? "workerBeforePhotos" : "workerAfterPhotos";
  const existing = Array.isArray(reqRow[field]) ? (reqRow[field] as string[]) : [];
  if (existing.length >= 5) {
    return NextResponse.json({ success: false, message: "最多只能传5张照片" }, { status: 400 });
  }

  let url: string;
  try {
    url = await uploadDataUrl(d.dataUrl, `${reqRow.contractId}_MAINT_${d.slot}_${reqRow.requestCode}_${Date.now()}.jpg`);
  } catch (e) {
    return NextResponse.json(
      { success: false, message: "上传失败: " + (e instanceof Error ? e.message : String(e)) },
      { status: 500 }
    );
  }

  await prisma.maintenanceRequest.update({
    where: { requestCode: requestId },
    data: {
      [field]: [...existing, url],
      ...(d.slot === "before" && reqRow.status === "ACKNOWLEDGED" ? { status: "IN_PROGRESS" } : {}),
    },
  });

  return NextResponse.json({ success: true, message: "✅ 照片已上传" });
}
