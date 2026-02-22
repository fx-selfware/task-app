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

describe('AC-SEC2: Non-member cannot see task list at all (404 not 403)', () => {
  it('returns 404 for a list that exists but user has no access', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/task-lists',
      payload: { name: 'Alice Private List' },
      headers: { cookie: cookieA },
    });
    const listId = createRes.json().list.id;

    // Bob has no access, should get 404 (not 403, to not leak existence)
    const res = await app.inject({
      method: 'GET',
      url: `/api/task-lists/${listId}`,
      headers: { cookie: cookieB },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('AC-SEC1: Non-owner cannot modify task list', () => {
  it('shared user (even WRITE) cannot rename the list', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/task-lists',
      payload: { name: 'Alice List' },
      headers: { cookie: cookieA },
    });
    const listId = createRes.json().list.id;

    await app.inject({
      method: 'POST',
      url: `/api/task-lists/${listId}/shares`,
      payload: { email: 'bob@example.com', permission: 'WRITE' },
      headers: { cookie: cookieA },
    });

    const renameRes = await app.inject({
      method: 'PATCH',
      url: `/api/task-lists/${listId}`,
      payload: { name: 'Hijacked' },
      headers: { cookie: cookieB },
    });
    expect(renameRes.statusCode).toBe(403);
  });

  it('shared user cannot delete the list', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/task-lists',
      payload: { name: 'Alice List' },
      headers: { cookie: cookieA },
    });
    const listId = createRes.json().list.id;

    await app.inject({
      method: 'POST',
      url: `/api/task-lists/${listId}/shares`,
      payload: { email: 'bob@example.com', permission: 'WRITE' },
      headers: { cookie: cookieA },
    });

    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/task-lists/${listId}`,
      headers: { cookie: cookieB },
    });
    expect(deleteRes.statusCode).toBe(403);
  });
});

describe('AC-SEC3: Template only visible to owner', () => {
  it('non-owner gets 404 for template', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/templates',
      payload: { name: 'Alice Template' },
      headers: { cookie: cookieA },
    });
    const templateId = createRes.json().template.id;

    const res = await app.inject({
      method: 'GET',
      url: `/api/templates/${templateId}`,
      headers: { cookie: cookieB },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('AC-A7: Cookie security', () => {
  it('token cookie is HttpOnly and SameSite=Strict', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'alice@example.com', password: 'password123' },
    });

    // Need to register first
    const regRes = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'test@example.com', password: 'password123', name: 'Test' },
    });
    const setCookie = regRes.headers['set-cookie'] as string;
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Strict/i);
    expect(setCookie).not.toContain('Secure'); // COOKIE_SECURE=false in test env
  });
});

describe('Unauthenticated access', () => {
  it('all protected routes return 401 without cookie', async () => {
    const routes = [
      { method: 'GET', url: '/api/auth/me' },
      { method: 'GET', url: '/api/task-lists' },
      { method: 'POST', url: '/api/task-lists' },
      { method: 'GET', url: '/api/templates' },
      { method: 'POST', url: '/api/templates' },
    ] as const;

    for (const route of routes) {
      const res = await app.inject({ method: route.method, url: route.url });
      expect(res.statusCode, `${route.method} ${route.url} should be 401`).toBe(401);
    }
  });
});
