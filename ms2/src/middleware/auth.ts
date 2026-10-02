// src/middleware/auth.ts
import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../modules/auth/auth.service.js';
import { prisma } from '../lib/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import type { Role } from '@prisma/client';

export interface AuthUser {
  id: string;
  role: Role;
  isBanned: boolean;
}

// Augment Express Request so TypeScript knows about req.user
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

async function resolveUser(req: Request): Promise<AuthUser | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  try {
    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, role: true, isBanned: true },
    });
    return user;
  } catch {
    return null;
  }
}

/** Requires a valid Bearer token; throws 401 if missing/invalid, 403 if banned. */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  void (async () => {
    const user = await resolveUser(req);
    if (!user) return next(ApiError.unauthorized());
    if (user.isBanned) return next(ApiError.forbidden('Your account has been suspended'));
    req.user = user;
    next();
  })();
}

/** Attaches user to req if token is present, but does NOT block unauthenticated requests. */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  void (async () => {
    const user = await resolveUser(req);
    if (user && !user.isBanned) req.user = user;
    next();
  })();
}
