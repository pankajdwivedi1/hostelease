import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

let prismaInstance: PrismaClient | null = null;

function getDatabaseUrl(): string | undefined {
  let url = process.env.DATABASE_URL;
  if (!url) return undefined;

  const configuredLimit = Number.parseInt(process.env.DATABASE_CONNECTION_LIMIT || "10", 10);
  const connectionLimit = Number.isFinite(configuredLimit)
    ? Math.max(1, Math.min(configuredLimit, 30))
    : 10;
  const configuredPoolTimeout = Number.parseInt(process.env.DATABASE_POOL_TIMEOUT || "20", 10);
  const poolTimeout = Number.isFinite(configuredPoolTimeout)
    ? Math.max(1, Math.min(configuredPoolTimeout, 120))
    : 20;

  // Keep the pool configurable for deployments with different database limits.
  if (!url.includes('connection_limit=')) {
    const sep = url.includes('?') ? '&' : '?';
    url = `${url}${sep}connection_limit=${connectionLimit}&pool_timeout=${poolTimeout}`;
  }
  process.env.DATABASE_URL = url;
  return url;
}

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
    const dbUrl = getDatabaseUrl();
    prismaInstance = new PrismaClient({
      datasources: dbUrl ? { db: { url: dbUrl } } : undefined,
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

