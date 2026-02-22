import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import { config } from './config';
import { prismaPlugin } from './plugins/prisma';
import { registerRoutes } from './routes';

export async function buildApp() {
  const app = Fastify({
    logger: config.NODE_ENV !== 'test',
  });

  await app.register(fastifyCookie);
  await app.register(prismaPlugin);
  await app.register(registerRoutes, { prefix: '/api' });

  return app;
}
