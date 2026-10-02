// src/middleware/errorHandler.ts
import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../lib/logger.js';

interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details: unknown[];
  };
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  // Zod validation error
  if (err instanceof ZodError) {
    const details = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    const body: ErrorResponse = {
      error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details },
    };
    res.status(400).json(body);
    return;
  }

  // Our own ApiError
  if (err instanceof ApiError) {
    if (err.statusCode >= 500) {
      logger.error({ err, path: req.path, method: req.method }, 'Server error');
    }
    const body: ErrorResponse = {
      error: { code: err.code, message: err.message, details: err.details },
    };
    res.status(err.statusCode).json(body);
    return;
  }

  // Unknown error
  logger.error({ err, path: req.path, method: req.method }, 'Unhandled error');
  const body: ErrorResponse = {
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', details: [] },
  };
  res.status(500).json(body);
}
