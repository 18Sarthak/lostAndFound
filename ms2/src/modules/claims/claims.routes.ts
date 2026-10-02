// src/modules/claims/claims.routes.ts
import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { authenticate } from '../../middleware/auth.js';
import { SubmitClaimSchema, UpdateClaimStatusSchema, ClaimIdSchema } from './claims.schemas.js';
import {
  submitClaimHandler,
  getItemClaimsHandler,
  updateClaimStatusHandler,
  cancelClaimHandler,
} from './claims.controller.js';

const router = Router({ mergeParams: true });

// POST /items/:id/claims
router.post('/', authenticate, validate({ body: SubmitClaimSchema }), submitClaimHandler);

// GET /items/:id/claims (owner/admin)
router.get('/', authenticate, getItemClaimsHandler);

export { router as itemClaimsRouter };

// Standalone claim routes (mounted at /claims/:claimId)
const claimsRouter = Router();

// PATCH /claims/:claimId (owner decision: APPROVED|REJECTED)
claimsRouter.patch(
  '/:claimId',
  authenticate,
  validate({ params: ClaimIdSchema, body: UpdateClaimStatusSchema }),
  updateClaimStatusHandler,
);

// DELETE /claims/:claimId (claimant cancel)
claimsRouter.delete(
  '/:claimId',
  authenticate,
  validate({ params: ClaimIdSchema }),
  cancelClaimHandler,
);

export { claimsRouter };
