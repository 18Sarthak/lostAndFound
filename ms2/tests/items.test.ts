// tests/items.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { cleanDb, createTestUser, createTestCategory } from './setup.js';
import { env } from '../src/config/env.js';
import jwt from 'jsonwebtoken';

const app = createApp();

function makeToken(userId: string, role = 'USER') {
  return jwt.sign({ userId, role }, env.JWT_ACCESS_SECRET, { expiresIn: '1h' });
}

describe('Items', () => {
  beforeEach(async () => {
    await cleanDb();
  });

  it('GET /api/v1/items returns empty list', async () => {
    const res = await request(app).get('/api/v1/items');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.meta).toBeDefined();
  });

  it('POST /api/v1/items requires authentication', async () => {
    const res = await request(app).post('/api/v1/items').send({ title: 'test' });
    expect(res.status).toBe(401);
  });

  it('POST /api/v1/items creates a LOST item', async () => {
    const user = await createTestUser('item-creator@test.example');
    const cat = await createTestCategory();
    const token = makeToken(user.id);

    const res = await request(app)
      .post('/api/v1/items')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'LOST',
        title: 'Lost my backpack',
        description: 'Blue Jansport backpack with laptop inside',
        categoryId: cat.id,
        eventDate: new Date(Date.now() - 86400000).toISOString(),
      });

    expect(res.status).toBe(201);
    expect(res.body.data.type).toBe('LOST');
    expect(res.body.data.title).toBe('Lost my backpack');
    // verificationAnswer must never be in response
    expect(res.body.data.verificationAnswer).toBeUndefined();
  });

  it('POST /api/v1/items with future eventDate returns 400', async () => {
    const user = await createTestUser('future-date@test.example');
    const cat = await createTestCategory();
    const token = makeToken(user.id);

    const res = await request(app)
      .post('/api/v1/items')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'LOST',
        title: 'Future item',
        description: 'This should fail validation',
        categoryId: cat.id,
        eventDate: new Date(Date.now() + 86400000).toISOString(),
      });

    expect(res.status).toBe(400);
  });

  it('FOUND item requires verificationQuestion and verificationAnswer', async () => {
    const user = await createTestUser('found-item@test.example');
    const cat = await createTestCategory();
    const token = makeToken(user.id);

    const res = await request(app)
      .post('/api/v1/items')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'FOUND',
        title: 'Found a phone',
        description: 'Found a phone in the library',
        categoryId: cat.id,
        eventDate: new Date(Date.now() - 86400000).toISOString(),
        // Missing verificationQuestion and verificationAnswer
      });

    expect(res.status).toBe(400);
  });

  it('GET /api/v1/items/:id shows verificationQuestion to non-owner but not to owner', async () => {
    const owner = await createTestUser('owner@test.example');
    const nonOwner = await createTestUser('visitor@test.example');
    const cat = await createTestCategory();
    const ownerToken = makeToken(owner.id);
    const visitorToken = makeToken(nonOwner.id);

    const createRes = await request(app)
      .post('/api/v1/items')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        type: 'FOUND',
        title: 'Found wallet',
        description: 'Found a brown leather wallet in the cafeteria area',
        categoryId: cat.id,
        eventDate: new Date(Date.now() - 86400000).toISOString(),
        verificationQuestion: 'What colour is the wallet?',
        verificationAnswer: 'brown',
      });
    expect(createRes.status).toBe(201);
    const itemId = createRes.body.data.id;

    // Owner should NOT see verificationQuestion in detail view
    const ownerRes = await request(app)
      .get(`/api/v1/items/${itemId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(ownerRes.status).toBe(200);
    expect(ownerRes.body.data.verificationQuestion).toBeNull();

    // Non-owner should see the question
    const visitorRes = await request(app)
      .get(`/api/v1/items/${itemId}`)
      .set('Authorization', `Bearer ${visitorToken}`);
    expect(visitorRes.status).toBe(200);
    expect(visitorRes.body.data.verificationQuestion).toBe('What colour is the wallet?');
  });

  it('DELETE /api/v1/items/:id by non-owner returns 403', async () => {
    const owner = await createTestUser('del-owner@test.example');
    const other = await createTestUser('del-other@test.example');
    const cat = await createTestCategory();

    const createRes = await request(app)
      .post('/api/v1/items')
      .set('Authorization', `Bearer ${makeToken(owner.id)}`)
      .send({
        type: 'LOST',
        title: 'Lostt item',
        description: 'Will someone try to delete this?',
        categoryId: cat.id,
        eventDate: new Date(Date.now() - 86400000).toISOString(),
      });
    const itemId = createRes.body.data.id;

    const delRes = await request(app)
      .delete(`/api/v1/items/${itemId}`)
      .set('Authorization', `Bearer ${makeToken(other.id)}`);
    expect(delRes.status).toBe(403);
  });
});
