// src/modules/users/users.controller.ts
import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { getUserItems } from '../items/items.service.js';
import { getUserClaims } from '../claims/claims.service.js';

export const getUserItemsHandler = asyncHandler(async (req: Request, res: Response) => {
  const result = await getUserItems(
    req.user!.id,
    Number(req.query['page']) || 1,
    Number(req.query['limit']) || 20,
  );
  res.json(result);
});

export const getUserClaimsHandler = asyncHandler(async (req: Request, res: Response) => {
  const result = await getUserClaims(
    req.user!.id,
    Number(req.query['page']) || 1,
    Number(req.query['limit']) || 20,
  );
  res.json(result);
});
