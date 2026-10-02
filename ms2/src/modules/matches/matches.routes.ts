// src/modules/matches/matches.routes.ts
import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { getItemMatches, dismissMatch } from './matches.service.js';

const router = Router();

// GET /items/:id/matches (item owner only)
export function itemMatchesRouter() {
  const r = Router({ mergeParams: true });
  r.get(
    '/',
    authenticate,
    asyncHandler(async (req, res) => {
      const result = await getItemMatches(
        req.params['id']!,
        req.user!.id,
        Number(req.query['page']) || 1,
        Number(req.query['limit']) || 20,
      );
      res.json(result);
    }),
  );
  return r;
}

// POST /matches/:id/dismiss
router.post(
  '/:id/dismiss',
  authenticate,
  asyncHandler(async (req, res) => {
    const match = await dismissMatch(req.params['id']!, req.user!.id);
    res.json({ data: match });
  }),
);

export default router;
