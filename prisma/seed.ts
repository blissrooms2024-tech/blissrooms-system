import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

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

async function main() {
  const hash = await bcrypt.hash("1234", 10);

  const testUsers: Array<{ name: string; email: string; role: "BOSS" | "ADMIN" | "AGENT" | "TENANT" }> = [
    { name: "Boss", email: "boss@bliss.com", role: "BOSS" },
    { name: "Admin", email: "admin@bliss.com", role: "ADMIN" },
    { name: "Agent Barry", email: "agent@bliss.com", role: "AGENT" },
    { name: "Tenant Test", email: "tenant@bliss.com", role: "TENANT" },
  ];

  for (const u of testUsers) {
    const existing = await prisma.user.findUnique({ where: { email: u.email } });
    if (existing) continue;
    await prisma.user.create({
      data: {
        userCode: await nextSeq("U"),
        name: u.name,
        email: u.email,
        passwordHash: hash,
        role: u.role,
        commRate: u.role === "AGENT" ? 0.5 : null,
        status: "ACTIVE",
        verified: true,
      },
    });
  }
  console.log("✅ 4 个测试账号建好了, 密码都是 1234");

  const properties = ["Pixel KL", "Nikka Penang", "Majestic Maxim"];
  const codes = ["PXC", "NCS", "MMB"];
  const statuses: Array<"VACANT" | "OCCUPIED" | "MAINTENANCE"> = ["VACANT", "OCCUPIED", "VACANT", "MAINTENANCE"];

  let n = 0;
  for (let pi = 0; pi < properties.length; pi++) {
    const propertyName = properties[pi];
    for (let i = 1; i <= 4; i++) {
      const roomCode = `${codes[pi]}-${String(i).padStart(2, "0")}`;
      const existing = await prisma.room.findUnique({ where: { roomCode } });
      if (existing) continue;
      await prisma.room.create({
        data: {
          roomCode,
          propertyName,
          roomType: i % 2 ? "Master Room" : "Single Room",
          roomRental: 500 + i * 50,
          carparkRental: i === 1 ? 80 : 0,
          status: statuses[n % statuses.length],
        },
      });
      n++;
    }
  }
  console.log("✅ 假房塞好了 (12 间)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
