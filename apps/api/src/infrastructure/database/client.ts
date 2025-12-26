import { PrismaClient } from '@prisma/client';
import { getConfig } from '../config/index.js';

let prisma: PrismaClient | undefined;

export function getPrismaClient(): PrismaClient {
  if (prisma) {
    return prisma;
  }

  const config = getConfig();

  prisma = new PrismaClient({
    log:
      config.NODE_ENV === 'development'
        ? ['query', 'info', 'warn', 'error']
        : ['error'],
  });

  return prisma;
}

export async function disconnectPrisma(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = undefined;
  }
}

export { prisma };
