// tests/claims.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { cleanDb, createTestUser, createTestCategory } from './setup.js';
import { env } from '../src/config/env.js';
import jwt from 'jsonwebtoken';

const app = createApp();

function makeToken(userId: string, role = 'USER') {
  return jwt.sign({ userId, role }, env.JWT_ACCESS_SECRET, { expiresIn: '1h' });
}

async function createFoundItem(ownerToken: string, categoryId: number, handoverPointId?: string) {
  const res = await request(app)
    .post('/api/v1/items')
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({
      type: 'FOUND',
      title: 'Found test item',
      description: 'A test found item for claim testing purposes',
      categoryId,
      eventDate: new Date(Date.now() - 86400000).toISOString(),
      verificationQuestion: 'What is the secret word?',
      verificationAnswer: 'watermelon',
      handoverPointId,
    });
  return res.body.data;
}

describe('Claims flow', () => {
  beforeEach(async () => {
    await cleanDb();
  });

  it('Wrong answer is rejected; answerMatches=false is stored', async () => {
    const owner = await createTestUser('claim-owner@test.example');
    const claimant = await createTestUser('claimant@test.example');
    const cat = await createTestCategory();

    const item = await createFoundItem(makeToken(owner.id), cat.id);

    const res = await request(app)
      .post(`/api/v1/items/${item.id}/claims`)
      .set('Authorization', `Bearer ${makeToken(claimant.id)}`)
      .send({ answer: 'wrong answer', note: 'I think this is mine' });

    expect(res.status).toBe(201);
    // answerMatches is shown to owner (for sorting/prioritization)
    expect(res.body.data.answerMatches).toBe(false);
    // The answer field itself must never be returned
    expect(res.body.data.answer).toBeUndefined();
  });

  it('Correct answer results in answerMatches=true', async () => {
    const owner = await createTestUser('correct-owner@test.example');
    const claimant = await createTestUser('correct-claimant@test.example');
    const cat = await createTestCategory();

    const item = await createFoundItem(makeToken(owner.id), cat.id);

    const res = await request(app)
      .post(`/api/v1/items/${item.id}/claims`)
      .set('Authorization', `Bearer ${makeToken(claimant.id)}`)
      .send({ answer: 'Watermelon', note: 'Case insensitive match' });

    expect(res.status).toBe(201);
    expect(res.body.data.answerMatches).toBe(true);
  });

  it('Cannot claim own item', async () => {
    const owner = await createTestUser('self-claim@test.example');
    const cat = await createTestCategory();

    const item = await createFoundItem(makeToken(owner.id), cat.id);

    const res = await request(app)
      .post(`/api/v1/items/${item.id}/claims`)
      .set('Authorization', `Bearer ${makeToken(owner.id)}`)
      .send({ answer: 'watermelon' });

    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/own item/i);
  });

  it('Duplicate claim is rejected with 409', async () => {
    const owner = await createTestUser('dup-owner@test.example');
    const claimant = await createTestUser('dup-claimant@test.example');
    const cat = await createTestCategory();

    const item = await createFoundItem(makeToken(owner.id), cat.id);
    const claimantToken = makeToken(claimant.id);

    await request(app)
      .post(`/api/v1/items/${item.id}/claims`)
      .set('Authorization', `Bearer ${claimantToken}`)
      .send({ answer: 'watermelon' });

    const res = await request(app)
      .post(`/api/v1/items/${item.id}/claims`)
      .set('Authorization', `Bearer ${claimantToken}`)
      .send({ answer: 'watermelon' });

    expect(res.status).toBe(409);
  });

  it('Owner can approve a claim; item becomes CLAIMED; others get auto-rejected', async () => {
    const owner = await createTestUser('approve-owner@test.example');
    const claimant1 = await createTestUser('approve-c1@test.example');
    const claimant2 = await createTestUser('approve-c2@test.example');
    const cat = await createTestCategory();

    const item = await createFoundItem(makeToken(owner.id), cat.id);
    const ownerToken = makeToken(owner.id);

    const c1Res = await request(app)
      .post(`/api/v1/items/${item.id}/claims`)
      .set('Authorization', `Bearer ${makeToken(claimant1.id)}`)
      .send({ answer: 'watermelon' });
    const claimId = c1Res.body.data.id;

    await request(app)
      .post(`/api/v1/items/${item.id}/claims`)
      .set('Authorization', `Bearer ${makeToken(claimant2.id)}`)
      .send({ answer: 'wrong' });

    // Approve first claim
    const approveRes = await request(app)
      .patch(`/api/v1/claims/${claimId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ status: 'APPROVED' });

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.status).toBe('APPROVED');

    // Check item is now CLAIMED
    const itemRes = await request(app)
      .get(`/api/v1/items/${item.id}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(itemRes.body.data.status).toBe('CLAIMED');
  });

  it('Non-owner cannot view claims', async () => {
    const owner = await createTestUser('perm-owner@test.example');
    const other = await createTestUser('perm-other@test.example');
    const cat = await createTestCategory();

    const item = await createFoundItem(makeToken(owner.id), cat.id);

    const res = await request(app)
      .get(`/api/v1/items/${item.id}/claims`)
      .set('Authorization', `Bearer ${makeToken(other.id)}`);
    expect(res.status).toBe(403);
  });
});
