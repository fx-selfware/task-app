import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import { config } from './config';
import { prismaPlugin } from './plugins/prisma';
import { registerRoutes } from './routes';
import { HttpError } from './utils/httpError';

export async function buildApp() {
  const app = Fastify({
    logger: config.NODE_ENV !== 'test',
  });

  app.setErrorHandler((error, _request, reply) => {
    const status = error instanceof HttpError ? error.statusCode : (error.statusCode ?? 500);
    reply.status(status).send({ error: error.message });
  });

  await app.register(fastifyCookie);
  await app.register(prismaPlugin);
  await app.register(registerRoutes, { prefix: '/api' });

  return app;
}
