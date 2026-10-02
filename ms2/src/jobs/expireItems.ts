// src/jobs/expireItems.ts
// Daily job: mark ACTIVE items past expiresAt as EXPIRED; warn 3 days before.
import { prisma } from '../lib/prisma.js';
import { notify } from '../lib/notifications.js';
import { logger } from '../lib/logger.js';
import { ITEM_EXPIRY_WARNING_DAYS } from '../config/constants.js';

export async function expireItemsJob(): Promise<void> {
  const now = new Date();

  // 1. Mark expired items
  const expired = await prisma.item.findMany({
    where: { status: 'ACTIVE', expiresAt: { lte: now } },
    select: { id: true, userId: true, title: true },
  });

  for (const item of expired) {
    await prisma.item.update({ where: { id: item.id }, data: { status: 'EXPIRED' } });
    await notify({
      userId: item.userId,
      type: 'SYSTEM',
      title: `Your item "${item.title}" has expired`,
      body: 'Your item listing has expired. You can re-post it if it is still relevant.',
      link: `/items/${item.id}`,
    });
  }

  // 2. Send expiry warnings (3 days before)
  const warningDate = new Date(now.getTime() + ITEM_EXPIRY_WARNING_DAYS * 24 * 60 * 60 * 1000);
  const expiringSoon = await prisma.item.findMany({
    where: {
      status: 'ACTIVE',
      expiresAt: { gt: now, lte: warningDate },
    },
    select: { id: true, userId: true, title: true, expiresAt: true },
  });

  for (const item of expiringSoon) {
    await notify({
      userId: item.userId,
      type: 'ITEM_EXPIRING',
      title: `⚠️ Your item "${item.title}" is expiring soon`,
      body: `This item will expire on ${item.expiresAt?.toDateString() ?? 'soon'}. It will be archived unless it is resolved.`,
      link: `/items/${item.id}`,
    });
  }

  logger.info(
    { expired: expired.length, expiringSoon: expiringSoon.length },
    'expireItems job complete',
  );
}
