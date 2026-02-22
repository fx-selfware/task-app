import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { getApp, closeApp, clearDb, registerAndLogin } from './helpers';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
let cookieA: string;
let cookieB: string;
let listId: string;

beforeAll(async () => {
  app = await getApp();
});

afterAll(async () => {
  await clearDb(app.prisma);
  await closeApp();
});

beforeEach(async () => {
  await clearDb(app.prisma);
  cookieA = await registerAndLogin(app, 'alice@example.com');
  cookieB = await registerAndLogin(app, 'bob@example.com');

  const createRes = await app.inject({
    method: 'POST',
    url: '/api/task-lists',
    payload: { name: 'Test List' },
    headers: { cookie: cookieA },
  });
  listId = createRes.json().list.id;
});

describe('POST /api/task-lists/:id/shares', () => {
  it('AC-S1: owner can share with existing user', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/task-lists/${listId}/shares`,
      payload: { email: 'bob@example.com', permission: 'READ' },
      headers: { cookie: cookieA },
    });
    expect(res.statusCode).toBe(201);
    const { share } = res.json();
    expect(share.permission).toBe('READ');
    expect(share.user.email).toBe('bob@example.com');
  });

  it('AC-S2: non-existent email → 404', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/task-lists/${listId}/shares`,
      payload: { email: 'nobody@example.com', permission: 'READ' },
      headers: { cookie: cookieA },
    });
    expect(res.statusCode).toBe(404);
  });

  it('AC-SEC4: duplicate share → 409', async () => {
    await app.inject({
      method: 'POST',
      url: `/api/task-lists/${listId}/shares`,
      payload: { email: 'bob@example.com', permission: 'READ' },
      headers: { cookie: cookieA },
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/task-lists/${listId}/shares`,
      payload: { email: 'bob@example.com', permission: 'WRITE' },
      headers: { cookie: cookieA },
    });
    expect(res.statusCode).toBe(409);
  });
});

describe('GET /api/task-lists/:id/shares', () => {
  it('AC-S3: owner can list shares', async () => {
    await app.inject({
      method: 'POST',
      url: `/api/task-lists/${listId}/shares`,
      payload: { email: 'bob@example.com', permission: 'READ' },
      headers: { cookie: cookieA },
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/task-lists/${listId}/shares`,
      headers: { cookie: cookieA },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().shares).toHaveLength(1);
    expect(res.json().shares[0].user.email).toBe('bob@example.com');
  });

  it('non-owner cannot list shares', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/task-lists/${listId}/shares`,
      headers: { cookie: cookieB },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('PATCH /api/task-lists/:id/shares/:sid', () => {
  it('AC-S4: owner can change permission', async () => {
    const shareRes = await app.inject({
      method: 'POST',
      url: `/api/task-lists/${listId}/shares`,
      payload: { email: 'bob@example.com', permission: 'READ' },
      headers: { cookie: cookieA },
    });
    const shareId = shareRes.json().share.id;

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/task-lists/${listId}/shares/${shareId}`,
      payload: { permission: 'WRITE' },
      headers: { cookie: cookieA },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().share.permission).toBe('WRITE');
  });
});

describe('DELETE /api/task-lists/:id/shares/:sid', () => {
  it('AC-S5: owner can revoke share', async () => {
    const shareRes = await app.inject({
      method: 'POST',
      url: `/api/task-lists/${listId}/shares`,
      payload: { email: 'bob@example.com', permission: 'READ' },
      headers: { cookie: cookieA },
    });
    const shareId = shareRes.json().share.id;

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/task-lists/${listId}/shares/${shareId}`,
      headers: { cookie: cookieA },
    });
    expect(res.statusCode).toBe(204);

    // Bob should no longer see the list
    const checkRes = await app.inject({
      method: 'GET',
      url: `/api/task-lists/${listId}`,
      headers: { cookie: cookieB },
    });
    expect(checkRes.statusCode).toBe(404);
  });
});
