// src/modules/auth/auth.service.ts
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { prisma } from '../../lib/prisma.js';
import { mailer, otpEmailHtml } from '../../lib/mailer.js';
import { env, allowedEmailDomains } from '../../config/env.js';
import {
  OTP_LENGTH,
  OTP_EXPIRY_MINUTES,
  OTP_MAX_ATTEMPTS,
} from '../../config/constants.js';
import { ApiError } from '../../utils/ApiError.js';
import { logger } from '../../lib/logger.js';
import type { RequestOtpInput, VerifyOtpInput } from './auth.schemas.js';

// ── Token payload types ───────────────────────────────────────────────────────
export interface AccessTokenPayload {
  userId: string;
  role: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function generateOtp(): string {
  // Cryptographically random OTP_LENGTH-digit code
  const max = Math.pow(10, OTP_LENGTH);
  const num = crypto.randomInt(0, max);
  return num.toString().padStart(OTP_LENGTH, '0');
}

function hashValue(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function issueAccessToken(userId: string, role: string): string {
  return jwt.sign({ userId, role } satisfies AccessTokenPayload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.ACCESS_TOKEN_TTL,
  } as jwt.SignOptions);
}

async function issueRefreshToken(
  userId: string,
  userAgent?: string,
  ip?: string,
  replacedId?: string,
): Promise<{ rawToken: string; tokenId: string }> {
  const rawToken = crypto.randomBytes(64).toString('hex');
  const tokenHash = hashValue(rawToken);
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

  const record = await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
      ...(userAgent !== undefined && { userAgent }),
      ...(ip !== undefined && { ip }),
      ...(replacedId !== undefined && { replacedById: replacedId }),
    },
  });
  return { rawToken, tokenId: record.id };
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
  if (typeof payload !== 'object' || payload === null || !('userId' in payload)) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid token');
  }
  return payload as AccessTokenPayload;
}

function isEmailDomainAllowed(email: string): boolean {
  if (allowedEmailDomains.length === 0) return true;
  const domain = email.split('@')[1]?.toLowerCase() ?? '';
  return allowedEmailDomains.includes(domain);
}

// ── Service functions ─────────────────────────────────────────────────────────

/**
 * Request an OTP for the given email.
 * Rate limiting (per-email + per-IP) is applied at the route level.
 * Intentionally returns the same message regardless of whether the user exists.
 */
export async function requestOtp(input: RequestOtpInput): Promise<void> {
  if (!isEmailDomainAllowed(input.email)) {
    throw ApiError.forbidden('Email domain not allowed. Please use your institutional email.');
  }

  // Invalidate existing unused OTPs for this email
  await prisma.otpCode.updateMany({
    where: { email: input.email, consumedAt: null, expiresAt: { gt: new Date() } },
    data: { expiresAt: new Date() }, // expire them immediately
  });

  const code = generateOtp();
  const codeHash = hashValue(code);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await prisma.otpCode.create({
    data: { email: input.email, codeHash, expiresAt },
  });

  await mailer.send({
    to: input.email,
    subject: 'Your Lost & Found verification code',
    html: otpEmailHtml(code, OTP_EXPIRY_MINUTES),
  });

  logger.info({ email: input.email }, 'OTP sent');
  // Never log the actual code
}

/**
 * Verify an OTP, create user if first time, issue tokens.
 */
export async function verifyOtp(
  input: VerifyOtpInput,
  userAgent?: string,
  ip?: string,
): Promise<{ accessToken: string; rawRefreshToken: string; isNewUser: boolean }> {
  const otpRecord = await prisma.otpCode.findFirst({
    where: {
      email: input.email,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!otpRecord) {
    throw ApiError.badRequest('No valid OTP found. Please request a new code.');
  }

  if (otpRecord.attempts >= OTP_MAX_ATTEMPTS) {
    throw ApiError.badRequest('Maximum verification attempts exceeded. Please request a new code.');
  }

  const codeHash = hashValue(input.code);
  const isValid = crypto.timingSafeEqual(
    Buffer.from(otpRecord.codeHash, 'hex'),
    Buffer.from(codeHash, 'hex'),
  );

  if (!isValid) {
    await prisma.otpCode.update({
      where: { id: otpRecord.id },
      data: { attempts: { increment: 1 } },
    });
    const remaining = OTP_MAX_ATTEMPTS - otpRecord.attempts - 1;
    throw ApiError.badRequest(
      remaining > 0
        ? `Invalid code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
        : 'Invalid code. No attempts remaining. Please request a new code.',
    );
  }

  // Mark OTP consumed
  await prisma.otpCode.update({
    where: { id: otpRecord.id },
    data: { consumedAt: new Date() },
  });

  // Find or create user
  let user = await prisma.user.findUnique({ where: { email: input.email } });
  const isNewUser = !user;

  if (!user) {
    if (!input.name) {
      throw ApiError.badRequest('Name is required for first-time sign-up.');
    }
    user = await prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        emailVerified: true,
        lastLoginAt: new Date(),
      },
    });
  } else {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, lastLoginAt: new Date() },
    });
  }

  if (user.isBanned) {
    throw ApiError.forbidden('Your account has been suspended.');
  }

  const { rawToken } = await issueRefreshToken(user.id, userAgent, ip);
  const accessToken = issueAccessToken(user.id, user.role);

  logger.info({ userId: user.id, isNewUser }, 'User authenticated');
  return { accessToken, rawRefreshToken: rawToken, isNewUser };
}

/**
 * Rotate refresh token with reuse detection.
 * If a revoked token is replayed, all tokens for that user are revoked.
 */
export async function refreshTokens(
  rawToken: string,
  userAgent?: string,
  ip?: string,
): Promise<{ accessToken: string; rawRefreshToken: string }> {
  const tokenHash = hashValue(rawToken);

  const record = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (!record) throw ApiError.unauthorized('Invalid refresh token');

  if (record.revokedAt) {
    // Reuse detected — revoke entire user's token family
    logger.warn({ userId: record.userId }, 'Refresh token reuse detected — revoking all tokens');
    await prisma.refreshToken.updateMany({
      where: { userId: record.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw ApiError.unauthorized('Session compromised. Please sign in again.');
  }

  if (record.expiresAt < new Date()) {
    throw ApiError.unauthorized('Refresh token expired. Please sign in again.');
  }

  // Revoke old token
  await prisma.refreshToken.update({
    where: { id: record.id },
    data: { revokedAt: new Date() },
  });

  // Issue new token (replacement chain)
  const user = await prisma.user.findUnique({
    where: { id: record.userId },
    select: { id: true, role: true, isBanned: true },
  });
  if (!user || user.isBanned) throw ApiError.forbidden('Account suspended');

  const { rawToken: newRaw } = await issueRefreshToken(user.id, userAgent, ip, record.id);
  const accessToken = issueAccessToken(user.id, user.role);

  return { accessToken, rawRefreshToken: newRaw };
}

/** Revoke the specific refresh token on logout. */
export async function revokeRefreshToken(rawToken: string): Promise<void> {
  const tokenHash = hashValue(rawToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

// Public user object safe to return
export const PUBLIC_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  emailVerified: true,
  avatarUrl: true,
  role: true,
  karmaPoints: true,
  isBanned: true,
  createdAt: true,
  lastLoginAt: true,
} as const;

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: PUBLIC_USER_SELECT,
  });
  if (!user) throw ApiError.notFound('User not found');
  return user;
}
