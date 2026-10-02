// src/middleware/notFound.ts
import type { Request, Response } from 'express';

export function notFound(req: Request, res: Response): void {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Cannot ${req.method} ${req.path}`,
      details: [],
    },
  });
}
