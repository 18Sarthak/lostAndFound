// src/app.ts
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pinoHttp = require('pino-http') as (opts: { logger: unknown }) => import('express').RequestHandler;
import { env, corsOrigins } from './config/env.js';
import { logger } from './lib/logger.js';
import { globalLimiter } from './middleware/rateLimiters.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';

// Route imports
import authRouter from './modules/auth/auth.routes.js';
import itemsRouter from './modules/items/items.routes.js';
import uploadsRouter from './modules/uploads/uploads.routes.js';
import categoriesRouter from './modules/categories/categories.routes.js';
import handoverPointsRouter from './modules/handover-points/handoverPoints.routes.js';
import usersRouter from './modules/users/users.routes.js';
import notificationsRouter from './modules/notifications/notifications.routes.js';
import adminRouter from './modules/admin/admin.routes.js';
import matchesRouter from './modules/matches/matches.routes.js';
import { claimsRouter, itemClaimsRouter } from './modules/claims/claims.routes.js';
import messagesRouter from './modules/messages/messages.routes.js';
import { itemMatchesRouter } from './modules/matches/matches.routes.js';
import { submitReportHandler } from './modules/reports/reports.controller.js';
import { authenticate } from './middleware/auth.js';

export function createApp() {
  const app = express();

  // ── Security headers ──────────────────────────────────────────────────────
  app.use(
    helmet({
      crossOriginEmbedderPolicy: false, // relaxed for API
    }),
  );

  // ── CORS ──────────────────────────────────────────────────────────────────
  app.use(
    cors({
      origin: corsOrigins.length > 0 ? corsOrigins : true,
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  );

  // ── Compression ───────────────────────────────────────────────────────────
  app.use(compression());

  // ── Body parsing ──────────────────────────────────────────────────────────
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  // Lightweight cookie parser (avoids an extra dependency)
  app.use((req, _res, next) => {
    const header = req.headers.cookie ?? '';
    const cookies: Record<string, string> = {};
    for (const pair of header.split(';')) {
      const idx = pair.indexOf('=');
      if (idx < 1) continue;
      const k = pair.slice(0, idx).trim();
      try { cookies[k] = decodeURIComponent(pair.slice(idx + 1).trim()); }
      catch { cookies[k] = pair.slice(idx + 1).trim(); }
    }
    (req as typeof req & { cookies: Record<string, string> }).cookies = cookies;
    next();
  });

  // ── Request logging ───────────────────────────────────────────────────────
  app.use(pinoHttp({ logger }));

  // ── Global rate limit ─────────────────────────────────────────────────────
  app.use(globalLimiter);

  // ── Health check ──────────────────────────────────────────────────────────
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), env: env.NODE_ENV });
  });

  // ── API v1 routes ─────────────────────────────────────────────────────────
  const api = express.Router();

  api.use('/auth', authRouter);
  api.use('/items', itemsRouter);
  api.use('/items/:id/claims', itemClaimsRouter);
  api.use('/items/:id/matches', itemMatchesRouter());
  api.use('/items/:id/report', authenticate, (req, res, next) => {
    // Re-expose :id as req.params.id for the controller
    submitReportHandler(req, res, next);
  });
  api.use('/claims', claimsRouter);
  api.use('/claims/:claimId/messages', messagesRouter);
  api.use('/uploads', uploadsRouter);
  api.use('/categories', categoriesRouter);
  api.use('/handover-points', handoverPointsRouter);
  api.use('/users', usersRouter);
  api.use('/notifications', notificationsRouter);
  api.use('/matches', matchesRouter);
  api.use('/admin', adminRouter);

  app.use('/api/v1', api);

  // ── OpenAPI docs ──────────────────────────────────────────────────────────
  // Lazy-loaded to keep startup fast
  void import('./openapi/spec.js').then(({ setupSwagger }) => setupSwagger(app)).catch(() => {
    logger.warn('Swagger UI not available');
  });

  // ── Error handling (must be last) ─────────────────────────────────────────
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
