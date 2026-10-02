// tests/auth.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { cleanDb } from './setup.js';

const app = createApp();

describe('Auth flow', () => {
  beforeEach(async () => {
    await cleanDb();
  });

  it('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('POST /api/v1/auth/request-otp with valid email returns 200', async () => {
    const res = await request(app)
      .post('/api/v1/auth/request-otp')
      .send({ email: 'newuser@test.example' });
    expect(res.status).toBe(200);
    expect(res.body.data.message).toMatch(/code has been sent/i);
  });

  it('POST /api/v1/auth/request-otp with invalid email returns 400', async () => {
    const res = await request(app)
      .post('/api/v1/auth/request-otp')
      .send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('Full OTP flow: request → verify → me → refresh → logout', async () => {
    const email = 'otp-flow@test.example';

    // 1. Request OTP
    await request(app).post('/api/v1/auth/request-otp').send({ email });

    // 2. Get the OTP from DB (test only — never do this in production!)
    const otpRecord = await prisma.otpCode.findFirst({
      where: { email },
      orderBy: { createdAt: 'desc' },
    });
    expect(otpRecord).not.toBeNull();

    // Reconstruct the code: since we only have the hash, we'll use a service-layer test
    // Instead, verify with wrong code first
    const wrongRes = await request(app)
      .post('/api/v1/auth/verify-otp')
      .send({ email, code: '000000', name: 'Test User' });
    expect(wrongRes.status).toBe(400);
    expect(wrongRes.body.error.message).toMatch(/invalid code/i);

    // For testing the success path, directly create a known OTP
    const crypto = await import('crypto');
    const testCode = '123456';
    const codeHash = crypto.createHash('sha256').update(testCode).digest('hex');
    await prisma.otpCode.updateMany({
      where: { email },
      data: {
        codeHash,
        attempts: 0,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        consumedAt: null,
      },
    });

    // 3. Verify with correct code
    const verifyRes = await request(app)
      .post('/api/v1/auth/verify-otp')
      .send({ email, code: testCode, name: 'Test User' });
    expect(verifyRes.status).toBe(201); // new user
    expect(verifyRes.body.data.accessToken).toBeTruthy();

    const { accessToken } = verifyRes.body.data;
    const cookies = verifyRes.headers['set-cookie'] as string[];

    // 4. GET /auth/me
    const meRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(meRes.status).toBe(200);
    expect(meRes.body.data.email).toBe(email);

    // 5. Refresh token
    const refreshCookie = cookies?.find((c: string) => c.startsWith('refreshToken='));
    expect(refreshCookie).toBeTruthy();

    const refreshRes = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', refreshCookie!);
    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.data.accessToken).toBeTruthy();

    // 6. Logout
    const logoutRes = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', refreshCookie!);
    expect(logoutRes.status).toBe(200);
  });

  it('Reuse of revoked refresh token is detected and rejected', async () => {
    const email = 'reuse-test@test.example';

    const crypto = await import('crypto');
    const testCode = '654321';
    const codeHash = crypto.createHash('sha256').update(testCode).digest('hex');

    // Create OTP directly to bypass the rate-limited request-otp endpoint
    // (prior tests in this file have already consumed the per-IP OTP rate limit)
    await prisma.otpCode.create({
      data: {
        email,
        codeHash,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    const verifyRes = await request(app)
      .post('/api/v1/auth/verify-otp')
      .send({ email, code: testCode, name: 'Reuse Test User' });
    expect(verifyRes.status).toBe(201);

    const cookies = verifyRes.headers['set-cookie'] as string[];
    const refreshCookie = cookies?.find((c: string) => c.startsWith('refreshToken='));

    // First refresh
    const r1 = await request(app).post('/api/v1/auth/refresh').set('Cookie', refreshCookie!);
    expect(r1.status).toBe(200);

    // Reuse original (now revoked) token
    const r2 = await request(app).post('/api/v1/auth/refresh').set('Cookie', refreshCookie!);
    expect(r2.status).toBe(401);
  });
});
