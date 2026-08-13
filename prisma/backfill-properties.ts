import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function nextSeq(prefix: string) {
  const c = await prisma.counter.upsert({
    where: { prefix },
    create: { prefix, seq: 1 },
    update: { seq: { increment: 1 } },
  });
  return `${prefix}-${String(c.seq).padStart(4, "0")}`;
}

/**
 * One-off migration for existing data: rooms created before the Property/Unit link existed
 * only have a free-text propertyName. Groups them by that text, creates one Property per
 * distinct name, and links the rooms to it. Safe to re-run — skips rooms already linked.
 */
async function main() {
  const unlinked = await prisma.room.findMany({
    where: { propertyId: null },
    select: { id: true, propertyName: true },
  });

  const byName = new Map<string, string[]>();
  for (const r of unlinked) {
    const name = r.propertyName.trim() || "未命名楼盘";
    if (!byName.has(name)) byName.set(name, []);
    byName.get(name)!.push(r.id);
  }

  for (const [name, roomIds] of byName) {
    let property = await prisma.property.findFirst({ where: { name } });
    if (!property) {
      property = await prisma.property.create({
        data: { propertyCode: await nextSeq("PPT"), name },
      });
      console.log(`+ 建了新 Unit: ${property.propertyCode} ${name}`);
    }
    const result = await prisma.room.updateMany({
      where: { id: { in: roomIds } },
      data: { propertyId: property.id },
    });
    console.log(`  链接了 ${result.count} 间房间到 ${property.propertyCode} ${name}`);
  }

  console.log(`✅ 完成，处理了 ${byName.size} 个楼盘名`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
