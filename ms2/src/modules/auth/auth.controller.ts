// src/modules/auth/auth.controller.ts
import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  requestOtp,
  verifyOtp,
  refreshTokens,
  revokeRefreshToken,
  getMe,
} from './auth.service.js';
import { env } from '../../config/env.js';

const REFRESH_COOKIE = 'refreshToken';

function cookieOptions(days: number) {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: days * 24 * 60 * 60 * 1000,
    path: '/',
  };
}

export const requestOtpHandler = asyncHandler(async (req: Request, res: Response) => {
  await requestOtp(req.body as { email: string });
  res.json({ data: { message: 'If this email is recognised, a code has been sent.' } });
});

export const verifyOtpHandler = asyncHandler(async (req: Request, res: Response) => {
  const { accessToken, rawRefreshToken, isNewUser } = await verifyOtp(
    req.body as { email: string; code: string; name?: string },
    req.headers['user-agent'],
    req.ip,
  );
  res.cookie(REFRESH_COOKIE, rawRefreshToken, cookieOptions(env.REFRESH_TOKEN_TTL_DAYS));
  res.status(isNewUser ? 201 : 200).json({ data: { accessToken } });
});

export const refreshHandler = asyncHandler(async (req: Request, res: Response) => {
  const rawToken = (req.cookies as Record<string, string | undefined>)[REFRESH_COOKIE];
  if (!rawToken) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'No refresh token', details: [] } });
    return;
  }
  const { accessToken, rawRefreshToken } = await refreshTokens(
    rawToken,
    req.headers['user-agent'],
    req.ip,
  );
  res.cookie(REFRESH_COOKIE, rawRefreshToken, cookieOptions(env.REFRESH_TOKEN_TTL_DAYS));
  res.json({ data: { accessToken } });
});

export const logoutHandler = asyncHandler(async (req: Request, res: Response) => {
  const rawToken = (req.cookies as Record<string, string | undefined>)[REFRESH_COOKIE];
  if (rawToken) await revokeRefreshToken(rawToken);
  res.clearCookie(REFRESH_COOKIE, { path: '/' });
  res.json({ data: { message: 'Logged out successfully' } });
});

export const meHandler = asyncHandler(async (req: Request, res: Response) => {
  const user = await getMe(req.user!.id);
  res.json({ data: user });
});
