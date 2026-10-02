// src/utils/asyncHandler.ts
import type { Request, Response, NextFunction, RequestHandler } from 'express';

/** Wraps an async route handler and forwards errors to Express error middleware. */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
