// src/modules/admin/admin.routes.ts
import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { prisma } from '../../lib/prisma.js';
import { z } from 'zod';
import { ApiError } from '../../utils/ApiError.js';
import { buildMeta, parsePagination } from '../../utils/pagination.js';
import { notify } from '../../lib/notifications.js';

const router = Router();

// All admin routes require authentication + ADMIN or MODERATOR role
const staffOnly = [authenticate, requireRole('ADMIN', 'MODERATOR')];
const adminOnly = [authenticate, requireRole('ADMIN')];

// ── Reports ────────────────────────────────────────────────────────────────────
router.get(
  '/reports',
  ...staffOnly,
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query['page'], req.query['limit']);
    const resolved = req.query['resolved'] === 'true';
    const [reports, total] = await Promise.all([
      prisma.report.findMany({
        where: { resolved },
        include: {
          item: { select: { id: true, title: true } },
          reporter: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.report.count({ where: { resolved } }),
    ]);
    res.json({ data: reports, meta: buildMeta(page, limit, total) });
  }),
);

router.patch(
  '/reports/:id/resolve',
  ...staffOnly,
  asyncHandler(async (req, res) => {
    const id = req.params['id']!;
    const report = await prisma.report.update({
      where: { id },
      data: { resolved: true },
    });
    res.json({ data: report });
  }),
);

// ── Items moderation ───────────────────────────────────────────────────────────
router.get(
  '/items',
  ...staffOnly,
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query['page'], req.query['limit']);
    const status = (req.query['status'] as string | undefined) ?? 'PENDING_REVIEW';
    const [items, total] = await Promise.all([
      prisma.item.findMany({
        where: { status: status as never },
        include: {
          user: { select: { id: true, name: true, email: true } },
          category: true,
          images: { take: 1 },
        },
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
      }),
      prisma.item.count({ where: { status: status as never } }),
    ]);
    res.json({ data: items, meta: buildMeta(page, limit, total) });
  }),
);

const ApproveRejectSchema = z.object({
  action: z.enum(['approve', 'reject']),
  reason: z.string().max(500).optional(),
});

router.patch(
  '/items/:id/moderate',
  ...staffOnly,
  asyncHandler(async (req, res) => {
    const parsed = ApproveRejectSchema.safeParse(req.body);
    if (!parsed.success) throw ApiError.badRequest('Invalid input', parsed.error.errors);

    const itemId = req.params['id']!;
    const item = await prisma.item.findUnique({
      where: { id: itemId },
      select: { status: true, userId: true, title: true },
    });
    if (!item) throw ApiError.notFound('Item not found');
    if (item.status !== 'PENDING_REVIEW') throw ApiError.conflict('Item is not pending review');

    const newStatus = parsed.data.action === 'approve' ? 'ACTIVE' : 'REMOVED';
    await prisma.item.update({ where: { id: itemId }, data: { status: newStatus } });

    await notify({
      userId: item.userId,
      type: 'SYSTEM',
      title:
        parsed.data.action === 'approve'
          ? `✅ Your item "${item.title}" was approved`
          : `❌ Your item "${item.title}" was not approved`,
      body: parsed.data.reason ?? null,
      link: `/items/${itemId}`,
    });

    res.json({ data: { id: itemId, status: newStatus } });
  }),
);

// ── User management ────────────────────────────────────────────────────────────
router.patch(
  '/users/:id/ban',
  ...adminOnly,
  asyncHandler(async (req, res) => {
    const userId = req.params['id']!;
    const user = await prisma.user.update({
      where: { id: userId },
      data: { isBanned: true },
      select: { id: true, name: true, isBanned: true },
    });
    res.json({ data: user });
  }),
);

router.patch(
  '/users/:id/unban',
  ...adminOnly,
  asyncHandler(async (req, res) => {
    const userId = req.params['id']!;
    const user = await prisma.user.update({
      where: { id: userId },
      data: { isBanned: false },
      select: { id: true, name: true, isBanned: true },
    });
    res.json({ data: user });
  }),
);

// ── Stats ──────────────────────────────────────────────────────────────────────
router.get(
  '/stats',
  ...staffOnly,
  asyncHandler(async (_req, res) => {
    const [
      totalItems,
      byStatus,
      totalUsers,
      totalClaims,
      topCategories,
      recentReturns,
    ] = await Promise.all([
      prisma.item.count(),
      prisma.item.groupBy({ by: ['status'], _count: { id: true } }),
      prisma.user.count(),
      prisma.claim.count(),
      prisma.item.groupBy({
        by: ['categoryId'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      }),
      prisma.item.count({
        where: {
          status: 'RETURNED',
          returnedAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    // Map category IDs to names
    const categoryIds = topCategories.map((c) => c.categoryId);
    const categories = await prisma.category.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, name: true },
    });
    const catMap = Object.fromEntries(categories.map((c) => [c.id, c.name]));

    res.json({
      data: {
        totalItems,
        byStatus: byStatus.map((s) => ({ status: s.status, count: s._count.id })),
        totalUsers,
        totalClaims,
        topCategories: topCategories.map((c) => ({
          category: catMap[c.categoryId] ?? 'Unknown',
          count: c._count.id,
        })),
        returnsThisWeek: recentReturns,
      },
    });
  }),
);

export default router;
