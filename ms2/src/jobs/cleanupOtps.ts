// src/jobs/cleanupOtps.ts
// Daily: delete consumed/expired OTPs and old revoked refresh tokens (> 30 days).
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

export async function cleanupOtpsJob(): Promise<void> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [deletedOtps, deletedTokens] = await Promise.all([
    prisma.otpCode.deleteMany({
      where: {
        OR: [
          { expiresAt: { lte: now } },
          { consumedAt: { not: null } },
        ],
      },
    }),
    prisma.refreshToken.deleteMany({
      where: {
        OR: [
          { revokedAt: { not: null, lte: thirtyDaysAgo } },
          { expiresAt: { lte: now } },
        ],
      },
    }),
  ]);

  logger.info(
    { deletedOtps: deletedOtps.count, deletedTokens: deletedTokens.count },
    'cleanupOtps job complete',
  );
}
