// src/modules/reports/reports.controller.ts
import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { prisma } from '../../lib/prisma.js';
import { z } from 'zod';
import { ApiError } from '../../utils/ApiError.js';
import { stripHtml } from '../../utils/normalise.js';

const ReportSchema = z.object({
  reason: z.enum(['SPAM', 'FAKE_CLAIM', 'INAPPROPRIATE', 'PRIVACY_VIOLATION', 'OTHER']),
  details: z.string().max(1000).trim().optional(),
});

export const submitReportHandler = asyncHandler(async (req: Request, res: Response) => {
  const parsed = ReportSchema.safeParse(req.body);
  if (!parsed.success) throw ApiError.badRequest('Invalid report', parsed.error.errors);

  const itemId = req.params['id']!;
  const reporterId = req.user!.id;

  const existing = await prisma.report.findFirst({
    where: { itemId, reporterId },
  });
  if (existing) throw ApiError.conflict('You have already reported this item');

  const item = await prisma.item.findUnique({ where: { id: itemId }, select: { status: true } });
  if (!item || item.status === 'REMOVED') throw ApiError.notFound('Item not found');

  const report = await prisma.report.create({
    data: {
      itemId,
      reporterId,
      reason: parsed.data.reason,
      details: parsed.data.details ? stripHtml(parsed.data.details) : null,
    },
  });

  res.status(201).json({ data: report });
});
