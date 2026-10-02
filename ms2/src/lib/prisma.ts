// src/lib/prisma.ts
// Prisma client singleton — avoids multiple connections in hot-reload dev mode.
import { PrismaClient } from '@prisma/client';
import { logger } from './logger.js';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env['NODE_ENV'] === 'development'
        ? [{ emit: 'event', level: 'query' }, 'warn', 'error']
        : ['warn', 'error'],
  });

if (process.env['NODE_ENV'] === 'development') {
  globalForPrisma.prisma = prisma;
  // Log slow queries in dev
  type PrismaWithEvents = PrismaClient & { $on(event: string, fn: (e: { query: string; duration: number }) => void): void };
  (prisma as PrismaWithEvents).$on('query', (e: { query: string; duration: number }) => {
    if (e.duration > 500) {
      logger.warn({ query: e.query, duration: e.duration }, 'Slow query detected');
    }
  });
}
