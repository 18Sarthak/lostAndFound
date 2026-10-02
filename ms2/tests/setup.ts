// tests/setup.ts
import 'dotenv/config';
import { beforeAll, afterAll, beforeEach } from 'vitest';
import { prisma } from '../src/lib/prisma.js';

// Use a test database — set TEST_DATABASE_URL in .env.test
// For simplicity in CI, we use the same DB but clear tables between suites.

beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});

// Helpers shared across tests
export async function cleanDb() {
  // Delete in reverse dependency order to respect FK constraints.
  // We clear ALL rows in dependent tables because test files sharing a DB
  // can produce rows referencing users that don't match the @test. filter.
  await prisma.message.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.report.deleteMany();
  await prisma.claim.deleteMany();
  await prisma.match.deleteMany();
  await prisma.itemImage.deleteMany();
  await prisma.item.deleteMany();          // must come before user delete
  await prisma.refreshToken.deleteMany();
  await prisma.otpCode.deleteMany();
  await prisma.user.deleteMany({ where: { email: { contains: '@test.' } } });
}

export async function createTestUser(email = 'user@test.example', role: 'USER' | 'ADMIN' = 'USER') {
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name: 'Test User', emailVerified: true, role },
  });
}

export async function createTestCategory() {
  return prisma.category.upsert({
    where: { slug: 'test-cat' },
    update: {},
    create: { name: 'Test Category', slug: 'test-cat' },
  });
}
