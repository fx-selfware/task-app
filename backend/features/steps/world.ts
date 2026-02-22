import { World, setWorldConstructor, Before, After, BeforeAll, AfterAll, IWorldOptions } from '@cucumber/cucumber';
import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../../src/server';

// Shared single app instance across all scenarios (avoids Prisma runtime conflicts)
let sharedApp: FastifyInstance | null = null;

async function getSharedApp(): Promise<FastifyInstance> {
  if (!sharedApp) {
    sharedApp = await buildApp();
    await sharedApp.ready();
  }
  return sharedApp;
}

BeforeAll(async function () {
  sharedApp = await buildApp();
  await sharedApp.ready();
});

AfterAll(async function () {
  if (sharedApp) {
    await sharedApp.close();
    sharedApp = null;
  }
});

export class AppWorld extends World {
  app!: FastifyInstance;
  response!: { statusCode: number; headers: Record<string, string | string[]>; body: any };
  cookies: Record<string, string> = {};
  // Ids stored for cross-step references
  listId: string | null = null;
  taskId: string | null = null;
  shareId: string | null = null;
  templateId: string | null = null;
  templateTaskId: string | null = null;
  taskIds: string[] = [];
  tasksByTitle: Record<string, string> = {};
  myUserId: string | null = null;

  constructor(options: IWorldOptions) {
    super(options);
  }

  /** Inject a request and store the response. */
  async request(method: string, url: string, opts: { payload?: any; cookie?: string } = {}) {
    const res = await this.app.inject({
      method: method as any,
      url,
      payload: opts.payload,
      headers: opts.cookie ? { cookie: opts.cookie } : {},
    });
    this.response = {
      statusCode: res.statusCode,
      headers: res.headers as any,
      body: (() => {
        try {
          return res.json();
        } catch {
          return res.body;
        }
      })(),
    };
    return this.response;
  }

  /** Return the stored token cookie string. */
  get myCookie(): string {
    return this.cookies['me'] ?? '';
  }

  /** Return a cookie string for another user. */
  cookieFor(email: string): string {
    return this.cookies[email] ?? '';
  }
}

setWorldConstructor(AppWorld);

Before(async function (this: AppWorld) {
  this.app = sharedApp!;
  await clearDb(this.app.prisma);
  this.listId = null;
  this.taskId = null;
  this.shareId = null;
  this.templateId = null;
  this.templateTaskId = null;
  this.taskIds = [];
  this.tasksByTitle = {};
  this.myUserId = null;
  this.cookies = {};
});

export async function clearDb(prisma: PrismaClient) {
  await prisma.$transaction([
    prisma.templateTask.deleteMany(),
    prisma.taskTemplate.deleteMany(),
    prisma.taskListShare.deleteMany(),
    prisma.task.deleteMany(),
    prisma.taskList.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}

/** Register a user and return the cookie string. */
export async function registerUser(
  app: FastifyInstance,
  email: string,
  password: string,
  name = 'Test User',
): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { email, password, name },
  });
  const header = res.headers['set-cookie'] as string | undefined;
  return header?.split(';')[0] ?? '';
}
