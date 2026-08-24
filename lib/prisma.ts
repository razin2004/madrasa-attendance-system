import { PrismaClient } from '@prisma/client';

let dbUrl = process.env.DATABASE_URL || '';
if (dbUrl && !dbUrl.includes('connection_limit')) {
  dbUrl += (dbUrl.includes('?') ? '&' : '?') + 'connection_limit=5&pool_timeout=30';
}

const globalForPrisma = global as unknown as { prisma: PrismaClient };

const options: any = {
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
};

if (dbUrl) {
  options.datasources = {
    db: {
      url: dbUrl,
    },
  };
}

export const prisma = globalForPrisma.prisma || new PrismaClient(options);

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
