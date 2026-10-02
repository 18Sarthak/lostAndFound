// src/middleware/validate.ts
import type { Request, Response, NextFunction } from 'express';
import type { ZodTypeAny } from 'zod';

interface Schemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

/**
 * Express middleware that validates request body/query/params with Zod schemas.
 * On failure, throws a ZodError which is caught by errorHandler.
 */
export function validate(schemas: Schemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (schemas.body) {
      req.body = schemas.body.parse(req.body) as unknown;
    }
    if (schemas.query) {
      req.query = schemas.query.parse(req.query) as Record<string, string>;
    }
    if (schemas.params) {
      req.params = schemas.params.parse(req.params) as Record<string, string>;
    }
    next();
  };
}
