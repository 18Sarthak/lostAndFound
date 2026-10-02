// tests/notifications.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { cleanDb, createTestUser } from './setup.js';
import { env } from '../src/config/env.js';
import jwt from 'jsonwebtoken';

const app = createApp();

function makeToken(userId: string) {
  return jwt.sign({ userId, role: 'USER' }, env.JWT_ACCESS_SECRET, { expiresIn: '1h' });
}

describe('Notifications', () => {
  beforeEach(async () => {
    await cleanDb();
  });

  it('GET /api/v1/notifications returns empty for new user', async () => {
    const user = await createTestUser('notif-test@test.example');
    const res = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${makeToken(user.id)}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('Unread count is 0 for new user', async () => {
    const user = await createTestUser('notif-count@test.example');
    const res = await request(app)
      .get('/api/v1/notifications/unread-count')
      .set('Authorization', `Bearer ${makeToken(user.id)}`);
    expect(res.status).toBe(200);
    expect(res.body.data.count).toBe(0);
  });

  it('Created notification appears in list and increments unread count', async () => {
    const user = await createTestUser('notif-appear@test.example');

    await prisma.notification.create({
      data: {
        userId: user.id,
        type: 'SYSTEM',
        title: 'Test notification',
        body: 'This is a test notification body',
      },
    });

    const listRes = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${makeToken(user.id)}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(1);
    expect(listRes.body.data[0].title).toBe('Test notification');

    const countRes = await request(app)
      .get('/api/v1/notifications/unread-count')
      .set('Authorization', `Bearer ${makeToken(user.id)}`);
    expect(countRes.body.data.count).toBe(1);
  });

  it('POST /api/v1/notifications/read-all marks all as read', async () => {
    const user = await createTestUser('notif-readall@test.example');

    await prisma.notification.createMany({
      data: [
        { userId: user.id, type: 'SYSTEM', title: 'Notif 1' },
        { userId: user.id, type: 'SYSTEM', title: 'Notif 2' },
      ],
    });

    await request(app)
      .post('/api/v1/notifications/read-all')
      .set('Authorization', `Bearer ${makeToken(user.id)}`);

    const countRes = await request(app)
      .get('/api/v1/notifications/unread-count')
      .set('Authorization', `Bearer ${makeToken(user.id)}`);
    expect(countRes.body.data.count).toBe(0);
  });
});
