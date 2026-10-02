// src/middleware/requireRole.ts
import type { Request, Response, NextFunction } from 'express';
import type { Role } from '@prisma/client';
import { ApiError } from '../utils/ApiError.js';

/** Requires `authenticate` to have run first. Checks that user has one of the given roles. */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(ApiError.unauthorized());
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(ApiError.forbidden('Insufficient permissions'));
      return;
    }
    next();
  };
}
