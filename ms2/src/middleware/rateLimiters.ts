// src/middleware/rateLimiters.ts
import rateLimit from 'express-rate-limit';

const IS_DEV = process.env['NODE_ENV'] === 'development';

const json429 = (_req: unknown, res: { status: (c: number) => { json: (b: unknown) => void } }) => {
  res.status(429).json({
    error: { code: 'TOO_MANY_REQUESTS', message: 'Too many requests, please try again later.', details: [] },
  });
};

/** Global rate limit: 200 requests / 15 min per IP */
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: IS_DEV ? 10_000 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  handler: json429,
});

/** OTP request rate limit: 3 requests / 15 min per IP (relaxed in dev) */
export const otpRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: IS_DEV ? 1_000 : 3,
  standardHeaders: true,
  legacyHeaders: false,
  handler: json429,
  keyGenerator: (req) => `${req.ip ?? ''}-otp-request`,
});

/** Upload sign rate limit: 20 requests / 10 min per user */
export const uploadSignLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: IS_DEV ? 1_000 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: json429,
  keyGenerator: (req) => {
    const user = (req as typeof req & { user?: { id: string } }).user;
    return user ? `${user.id}-upload` : (req.ip ?? 'anon');
  },
});

/** Auth endpoints general limiter */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: IS_DEV ? 1_000 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: json429,
});
