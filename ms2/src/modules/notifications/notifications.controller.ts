// src/modules/notifications/notifications.controller.ts
import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { prisma } from '../../lib/prisma.js';
import { buildMeta, parsePagination } from '../../utils/pagination.js';

export const getNotificationsHandler = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = parsePagination(req.query['page'], req.query['limit']);
  const userId = req.user!.id;

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.notification.count({ where: { userId } }),
  ]);

  res.json({ data: notifications, meta: buildMeta(page, limit, total) });
});

export const markReadHandler = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params['id']!;
  const notification = await prisma.notification.findUnique({
    where: { id },
  });
  if (!notification || notification.userId !== req.user!.id) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Notification not found', details: [] } });
    return;
  }
  const updated = await prisma.notification.update({
    where: { id },
    data: { isRead: true },
  });
  res.json({ data: updated });
});

export const markAllReadHandler = asyncHandler(async (req: Request, res: Response) => {
  await prisma.notification.updateMany({
    where: { userId: req.user!.id, isRead: false },
    data: { isRead: true },
  });
  res.json({ data: { message: 'All notifications marked as read' } });
});

export const unreadCountHandler = asyncHandler(async (req: Request, res: Response) => {
  const count = await prisma.notification.count({
    where: { userId: req.user!.id, isRead: false },
  });
  res.json({ data: { count } });
});
