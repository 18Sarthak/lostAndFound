// src/modules/auth/auth.routes.ts
import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { authenticate } from '../../middleware/auth.js';
import { otpRequestLimiter, authLimiter } from '../../middleware/rateLimiters.js';
import { RequestOtpSchema, VerifyOtpSchema } from './auth.schemas.js';
import {
  requestOtpHandler,
  verifyOtpHandler,
  refreshHandler,
  logoutHandler,
  meHandler,
} from './auth.controller.js';

const router = Router();

// POST /auth/request-otp
router.post(
  '/request-otp',
  otpRequestLimiter,
  validate({ body: RequestOtpSchema }),
  requestOtpHandler,
);

// POST /auth/verify-otp
router.post(
  '/verify-otp',
  authLimiter,
  validate({ body: VerifyOtpSchema }),
  verifyOtpHandler,
);

// POST /auth/refresh
router.post('/refresh', authLimiter, refreshHandler);

// POST /auth/logout
router.post('/logout', logoutHandler);

// GET /auth/me
router.get('/me', authenticate, meHandler);

export default router;
