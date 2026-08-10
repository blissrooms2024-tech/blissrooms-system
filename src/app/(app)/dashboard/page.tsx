import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export default async function DashboardPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (session.role !== "BOSS" && session.role !== "ADMIN") redirect("/rooms");

  const rooms = await prisma.room.groupBy({ by: ["status"], _count: true });
  const counts: Record<string, number> = { VACANT: 0, OCCUPIED: 0, RESERVED: 0, MAINTENANCE: 0 };
  for (const r of rooms) counts[r.status] = r._count;

  const total = counts.VACANT + counts.OCCUPIED + counts.RESERVED + counts.MAINTENANCE;
  const rate = total ? Math.round((counts.OCCUPIED / total) * 100) : 0;

  const boxes = [
    { n: counts.VACANT, l: "空房" },
    { n: counts.OCCUPIED, l: "已出租" },
    { n: counts.RESERVED, l: "已订" },
    { n: counts.MAINTENANCE, l: "维修中" },
    { n: `${rate}%`, l: "出租率" },
  ];

  return (
    <div className="rounded-xl bg-white p-5 shadow-sm">
      <h3 className="mb-3.5 text-base font-semibold text-brand">📊 房间总览</h3>
      <div className="flex flex-wrap gap-3.5">
        {boxes.map((b) => (
          <div key={b.l} className="min-w-[110px] flex-1 rounded-xl bg-gray-50 p-3.5 text-center">
            <div className="text-2xl font-bold text-brand">{b.n}</div>
            <div className="text-xs text-gray-500">{b.l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
