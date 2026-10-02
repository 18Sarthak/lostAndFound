// src/modules/handover-points/handoverPoints.routes.ts
import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { prisma } from '../../lib/prisma.js';
import { z } from 'zod';
import { ApiError } from '../../utils/ApiError.js';

const router = Router();

const HandoverPointSchema = z.object({
  name: z.string().min(2).max(200),
  description: z.string().max(500).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  openingHours: z.string().max(200).optional(),
  isActive: z.boolean().optional(),
});

// GET /handover-points — public
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const points = await prisma.handoverPoint.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
    res.json({ data: points });
  }),
);

// Admin CRUD
router.post(
  '/',
  authenticate,
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const parsed = HandoverPointSchema.safeParse(req.body);
    if (!parsed.success) throw ApiError.badRequest('Invalid input', parsed.error.errors);
    const point = await prisma.handoverPoint.create({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: parsed.data as any,
    });
    res.status(201).json({ data: point });
  }),
);

router.patch(
  '/:id',
  authenticate,
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const parsed = HandoverPointSchema.partial().safeParse(req.body);
    if (!parsed.success) throw ApiError.badRequest('Invalid input', parsed.error.errors);
    const id = req.params['id']!;
    const point = await prisma.handoverPoint.update({
      where: { id },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: parsed.data as any,
    });
    res.json({ data: point });
  }),
);

router.delete(
  '/:id',
  authenticate,
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const id = req.params['id']!;
    await prisma.handoverPoint.update({
      where: { id },
      data: { isActive: false },
    });
    res.status(204).send();
  }),
);

export default router;
