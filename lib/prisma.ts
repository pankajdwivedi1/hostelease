import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

let prismaInstance: PrismaClient | null = null;

function getPrismaClient(): PrismaClient {
  const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build' || process.env.NEXT_PHASE?.includes('build');
  if (!process.env.DATABASE_URL && isBuildPhase) {
    return new Proxy({}, {
      get(target, prop) {
        return () => {};
      }
    }) as any;
  }

  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma;
  }
  if (!prismaInstance) {
    prismaInstance = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });
    globalForPrisma.prisma = prismaInstance;
  }
  return prismaInstance;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(target, prop) {
    const client = getPrismaClient();
    return Reflect.get(client, prop);
  }
});

export default prisma;

