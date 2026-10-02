// src/modules/categories/categories.routes.ts
import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { prisma } from '../../lib/prisma.js';

const router = Router();

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const categories = await prisma.category.findMany({ orderBy: { name: 'asc' } });
    res.json({ data: categories });
  }),
);

export default router;
