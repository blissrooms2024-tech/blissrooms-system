import { prisma } from "@/lib/prisma";

/**
 * Atomically allocates the next sequence number for `prefix` and formats it
 * the same way the original Apps Script `newId()` did: PREFIX-0001.
 */
export async function newId(prefix: string): Promise<string> {
  const counter = await prisma.counter.upsert({
    where: { prefix },
    create: { prefix, seq: 1 },
    update: { seq: { increment: 1 } },
  });
  return `${prefix}-${String(counter.seq).padStart(4, "0")}`;
}
