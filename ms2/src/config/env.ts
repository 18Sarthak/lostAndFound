// src/config/env.ts
// Fail fast on missing required environment variables.
import { z } from 'zod';
import 'dotenv/config';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  CLIENT_URL: z.string().url().default('http://localhost:5173'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),

  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be at least 16 chars'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 chars'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(14),

  ALLOWED_EMAIL_DOMAINS: z.string().default(''), // empty = allow all
  REQUIRE_MODERATION: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  ITEM_EXPIRY_DAYS: z.coerce.number().int().positive().default(60),

  RESEND_API_KEY: z.string().optional(),
  MAIL_FROM: z.string().default('Lost & Found <noreply@lostfound.local>'),

  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),

  MATCH_RADIUS_KM: z.coerce.number().positive().default(2),
  MATCH_DAYS_WINDOW: z.coerce.number().int().positive().default(14),
  MATCH_MIN_SCORE: z.coerce.number().min(0).max(1).default(0.45),
});

const _parsed = envSchema.safeParse(process.env);

if (!_parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(_parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = _parsed.data;

export const corsOrigins = env.CORS_ORIGINS.split(',')
  .map((s) => s.trim())
  .filter(Boolean);

export const allowedEmailDomains = env.ALLOWED_EMAIL_DOMAINS.split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);
