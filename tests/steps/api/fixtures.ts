import { test as base, createBdd } from 'playwright-bdd';
import { resetDb } from '../../support/resetDb';

export interface ApiResponse {
  statusCode: number;
  setCookies: string[];
  headers: Headers;
  body: any;
}

/**
 * Port of AppWorld in backend/features/steps/world.ts. Uses plain fetch so no
 * cookie jar exists — a request only carries a cookie when a step says so.
 */
export class ApiWorld {
  response!: ApiResponse;
  cookies: Record<string, string> = {};
  listId: string | null = null;
  taskId: string | null = null;
  shareId: string | null = null;
  templateId: string | null = null;
  templateTaskId: string | null = null;
  taskIds: string[] = [];
  tasksByTitle: Record<string, string> = {};
  myUserId: string | null = null;
  sentTaskId: string | null = null;
  notedVersion: string | null = null;

  constructor(private baseURL: string) {}

  async request(method: string, url: string, opts: { payload?: unknown; cookie?: string } = {}): Promise<ApiResponse> {
    const headers: Record<string, string> = {};
    if (opts.payload !== undefined) headers['content-type'] = 'application/json';
    if (opts.cookie) headers['cookie'] = opts.cookie;

    const res = await fetch(`${this.baseURL}${url}`, {
      method,
      headers,
      body: opts.payload !== undefined ? JSON.stringify(opts.payload) : undefined,
      redirect: 'manual',
    });

    const text = await res.text();
    let body: any;
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
    this.response = { statusCode: res.status, setCookies: res.headers.getSetCookie(), headers: res.headers, body };
    return this.response;
  }

  get myCookie(): string {
    return this.cookies['me'] ?? '';
  }

  cookieFor(email: string): string {
    return this.cookies[email] ?? '';
  }

  /** Register a user and return the "token=..." cookie pair. */
  async registerUser(email: string, password: string, name = 'Test User'): Promise<string> {
    const res = await fetch(`${this.baseURL}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    });
    const setCookie = res.headers.getSetCookie();
    return setCookie[0]?.split(';')[0] ?? '';
  }

  /** Register + fetch /api/auth/me, storing the cookie under `key`. */
  async loginAs(email: string, password: string, key = 'me'): Promise<void> {
    const cookie = await this.registerUser(email, password);
    this.cookies[key] = cookie;
    if (key === 'me') {
      const me = await this.request('GET', '/api/auth/me', { cookie });
      this.myUserId = me.body?.user?.id ?? null;
    }
  }
}

export const test = base.extend<{ world: ApiWorld }>({
  world: async ({ baseURL }, use) => {
    await resetDb();
    await use(new ApiWorld(baseURL!));
  },
});

export const { Given, When, Then } = createBdd(test);
