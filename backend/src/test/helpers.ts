import { FastifyInstance } from 'fastify';
import { buildApp } from '../server';
import { PrismaClient } from '@prisma/client';

let _app: FastifyInstance | null = null;

export async function getApp(): Promise<FastifyInstance> {
  if (!_app) {
    _app = await buildApp();
    await _app.ready();
  }
  return _app;
}

export async function closeApp() {
  if (_app) {
    await _app.close();
    _app = null;
  }
}

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

export async function registerAndLogin(
  app: FastifyInstance,
  email: string,
  password = 'password123',
  name = 'Test User',
): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { email, password, name },
  });

  if (res.statusCode === 409) {
    // Already registered, login instead
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password },
    });
    const cookieHeader = loginRes.headers['set-cookie'] as string | undefined;
    return cookieHeader?.split(';')[0] ?? '';
  }

  const cookieHeader = res.headers['set-cookie'] as string | undefined;
  return cookieHeader?.split(';')[0] ?? '';
}
