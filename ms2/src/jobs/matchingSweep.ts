// src/jobs/matchingSweep.ts
// Hourly: run matching for new ACTIVE items that haven't been matched yet.
import { prisma } from '../lib/prisma.js';
import { runMatchingForItem } from '../modules/matches/matches.service.js';
import { logger } from '../lib/logger.js';

export async function matchingSweepJob(): Promise<void> {
  // Find ACTIVE items with no matches yet (either side), created in last 2 hours
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const items = await prisma.item.findMany({
    where: {
      status: 'ACTIVE',
      createdAt: { gte: twoHoursAgo },
    },
    select: { id: true },
  });

  let processed = 0;
  for (const item of items) {
    try {
      await runMatchingForItem(item.id);
      processed++;
    } catch (err) {
      logger.warn({ itemId: item.id, err }, 'matchingSweep: error for item');
    }
  }

  logger.info({ processed, total: items.length }, 'matchingSweep job complete');
}
