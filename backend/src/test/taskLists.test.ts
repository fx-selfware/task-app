import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { getApp, closeApp, clearDb, registerAndLogin } from './helpers';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
let cookieA: string;
let cookieB: string;

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
});

describe('POST /api/task-lists', () => {
  it('AC-TL1: creates list owned by current user', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/task-lists',
      payload: { name: 'My List' },
      headers: { cookie: cookieA },
    });
    expect(res.statusCode).toBe(201);
    const { list } = res.json();
    expect(list.name).toBe('My List');

    const meRes = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie: cookieA },
    });
    expect(list.ownerId).toBe(meRes.json().user.id);
  });
});

describe('GET /api/task-lists', () => {
  it('AC-TL2: returns owned + shared lists', async () => {
    // Alice creates a list
    await app.inject({
      method: 'POST',
      url: '/api/task-lists',
      payload: { name: 'Alice List' },
      headers: { cookie: cookieA },
    });

    // Bob creates a list
    const bobListRes = await app.inject({
      method: 'POST',
      url: '/api/task-lists',
      payload: { name: 'Bob List' },
      headers: { cookie: cookieB },
    });
    const bobList = bobListRes.json().list;

    // Bob shares with Alice
    await app.inject({
      method: 'POST',
      url: `/api/task-lists/${bobList.id}/shares`,
      payload: { email: 'alice@example.com', permission: 'READ' },
      headers: { cookie: cookieB },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/task-lists',
      headers: { cookie: cookieA },
    });
    expect(res.statusCode).toBe(200);
    const { owned, shared } = res.json();
    expect(owned).toHaveLength(1);
    expect(owned[0].name).toBe('Alice List');
    expect(shared).toHaveLength(1);
    expect(shared[0].name).toBe('Bob List');
  });
});

describe('GET /api/task-lists/:id', () => {
  it('AC-TL3: owner gets list with tasks and shares', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/task-lists',
      payload: { name: 'My List' },
      headers: { cookie: cookieA },
    });
    const { list } = createRes.json();

    const res = await app.inject({
      method: 'GET',
      url: `/api/task-lists/${list.id}`,
      headers: { cookie: cookieA },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.list.tasks).toBeDefined();
    expect(body.list.shares).toBeDefined();
    expect(body.isOwner).toBe(true);
  });

  it('AC-TL6: non-member gets 404', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/task-lists',
      payload: { name: 'Private List' },
      headers: { cookie: cookieA },
    });
    const { list } = createRes.json();

    const res = await app.inject({
      method: 'GET',
      url: `/api/task-lists/${list.id}`,
      headers: { cookie: cookieB },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('PATCH /api/task-lists/:id', () => {
  it('AC-TL4: owner can rename', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/task-lists',
      payload: { name: 'Old Name' },
      headers: { cookie: cookieA },
    });
    const { list } = createRes.json();

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/task-lists/${list.id}`,
      payload: { name: 'New Name' },
      headers: { cookie: cookieA },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().list.name).toBe('New Name');
  });

  it('AC-SEC1: non-owner gets 403', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/task-lists',
      payload: { name: 'Alice List' },
      headers: { cookie: cookieA },
    });
    const { list } = createRes.json();

    // Share with Bob first so he can find the list
    await app.inject({
      method: 'POST',
      url: `/api/task-lists/${list.id}/shares`,
      payload: { email: 'bob@example.com', permission: 'WRITE' },
      headers: { cookie: cookieA },
    });

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/task-lists/${list.id}`,
      payload: { name: 'Hijacked' },
      headers: { cookie: cookieB },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe('DELETE /api/task-lists/:id', () => {
  it('AC-TL5: owner can delete', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/task-lists',
      payload: { name: 'To Delete' },
      headers: { cookie: cookieA },
    });
    const { list } = createRes.json();

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/task-lists/${list.id}`,
      headers: { cookie: cookieA },
    });
    expect(res.statusCode).toBe(204);

    const check = await app.inject({
      method: 'GET',
      url: `/api/task-lists/${list.id}`,
      headers: { cookie: cookieA },
    });
    expect(check.statusCode).toBe(404);
  });

  it('AC-SEC1: non-owner gets 403', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/task-lists',
      payload: { name: 'Alice List' },
      headers: { cookie: cookieA },
    });
    const { list } = createRes.json();

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/task-lists/${list.id}`,
      headers: { cookie: cookieB },
    });
    expect(res.statusCode).toBe(403);
  });
});
