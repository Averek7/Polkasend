import { Prisma, PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __polkasendPrisma__: PrismaClient | undefined;
}

export const prisma =
  global.__polkasendPrisma__ ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  global.__polkasendPrisma__ = prisma;
}

export { Prisma };
