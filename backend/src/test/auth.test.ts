import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { getApp, closeApp, clearDb } from './helpers';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

beforeAll(async () => {
  app = await getApp();
});

afterAll(async () => {
  await clearDb(app.prisma);
  await closeApp();
});

beforeEach(async () => {
  await clearDb(app.prisma);
});

describe('POST /api/auth/register', () => {
  it('AC-A1: creates account and sets httpOnly cookie', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'alice@example.com', password: 'password123', name: 'Alice' },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.user).toMatchObject({ email: 'alice@example.com', name: 'Alice' });
    expect(body.user.passwordHash).toBeUndefined();

    const setCookie = res.headers['set-cookie'] as string;
    expect(setCookie).toContain('token=');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Strict');
  });

  it('AC-A8: duplicate email → 409', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'bob@example.com', password: 'password123', name: 'Bob' },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'bob@example.com', password: 'different', name: 'Bob2' },
    });
    expect(res.statusCode).toBe(409);
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'alice@example.com', password: 'password123', name: 'Alice' },
    });
  });

  it('AC-A2: valid credentials → 200, cookie set', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'alice@example.com', password: 'password123' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.user.email).toBe('alice@example.com');
    expect(res.headers['set-cookie']).toContain('token=');
  });

  it('AC-A3: wrong password → 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'alice@example.com', password: 'wrongpassword' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('AC-A3: unknown email → 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'nobody@example.com', password: 'password123' },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('GET /api/auth/me', () => {
  it('AC-A4: valid cookie → 200 with user', async () => {
    const reg = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'alice@example.com', password: 'password123', name: 'Alice' },
    });
    const cookie = (reg.headers['set-cookie'] as string).split(';')[0];

    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().user.email).toBe('alice@example.com');
  });

  it('AC-A5: no cookie → 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/auth/me' });
    expect(res.statusCode).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('AC-A6: clears cookie', async () => {
    const reg = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'alice@example.com', password: 'password123', name: 'Alice' },
    });
    const cookie = (reg.headers['set-cookie'] as string).split(';')[0];

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { cookie },
    });
    expect(res.statusCode).toBe(200);
  });
});

describe('AC-A7: Cookie security flags', () => {
  it('token cookie has HttpOnly and SameSite=Strict', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'alice@example.com', password: 'password123', name: 'Alice' },
    });

    const setCookie = res.headers['set-cookie'] as string;
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Strict');
  });
});
