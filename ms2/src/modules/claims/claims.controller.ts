// src/modules/claims/claims.controller.ts
import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  submitClaim,
  getItemClaims,
  updateClaimStatus,
  cancelClaim,
  getUserClaims,
} from './claims.service.js';
import type { SubmitClaimInput, UpdateClaimStatusInput } from './claims.schemas.js';

export const submitClaimHandler = asyncHandler(async (req: Request, res: Response) => {
  const claim = await submitClaim(req.params['id']!, req.body as SubmitClaimInput, req.user!.id);
  res.status(201).json({ data: claim });
});

export const getItemClaimsHandler = asyncHandler(async (req: Request, res: Response) => {
  const result = await getItemClaims(
    req.params['id']!,
    req.user!.id,
    req.user!.role,
    Number(req.query['page']) || 1,
    Number(req.query['limit']) || 20,
  );
  res.json(result);
});

export const updateClaimStatusHandler = asyncHandler(async (req: Request, res: Response) => {
  const claim = await updateClaimStatus(
    req.params['claimId']!,
    req.body as UpdateClaimStatusInput,
    req.user!.id,
    req.user!.role,
  );
  res.json({ data: claim });
});

export const cancelClaimHandler = asyncHandler(async (req: Request, res: Response) => {
  const claim = await cancelClaim(req.params['claimId']!, req.user!.id);
  res.json({ data: claim });
});

export const getUserClaimsHandler = asyncHandler(async (req: Request, res: Response) => {
  const result = await getUserClaims(
    req.user!.id,
    Number(req.query['page']) || 1,
    Number(req.query['limit']) || 20,
  );
  res.json(result);
});
