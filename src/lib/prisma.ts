import "dotenv/config";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function client(): PrismaClient {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new Error("DATABASE_URL chưa được cấu hình. Xem .env.example.");
  const created = new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });
  // Cached on globalThis in every environment: survives dev HMR and reuses warm serverless instances.
  globalForPrisma.prisma = created;
  return created;
}

/** Connects on first use, so builds and pages that never query need no DATABASE_URL. */
export const prisma = new Proxy({} as PrismaClient, {
  get(_, prop) {
    const target = client();
    const value = Reflect.get(target, prop);
    return typeof value === "function" ? value.bind(target) : value;
  },
});
