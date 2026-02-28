import { FastifyInstance } from 'fastify';
import { requireAuth } from '../middleware/requireAuth';
import { registerUser, loginUser, signToken } from '../services/auth';
import { config } from '../config';

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'strict' as const,
  secure: config.COOKIE_SECURE,
  path: '/',
  maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
};

export async function authRoutes(app: FastifyInstance) {
  app.post('/auth/register', async (request, reply) => {
    const { email, password, name } = request.body as {
      email: string;
      password: string;
      name: string;
    };

    if (!email || !password || !name) {
      return reply.status(400).send({ error: 'email, password, and name are required' });
    }

    try {
      const user = await registerUser(app.prisma, { email, password, name });
      const token = signToken(user.id, user.email, user.role);
      reply.setCookie('token', token, COOKIE_OPTS);
      return reply.status(201).send({ user });
    } catch (err: unknown) {
      const e = err as Error & { statusCode?: number };
      return reply.status(e.statusCode ?? 500).send({ error: e.message });
    }
  });

  app.post('/auth/login', async (request, reply) => {
    const { email, password } = request.body as { email: string; password: string };

    if (!email || !password) {
      return reply.status(400).send({ error: 'email and password are required' });
    }

    try {
      const user = await loginUser(app.prisma, { email, password });
      const token = signToken(user.id, user.email, user.role);
      reply.setCookie('token', token, COOKIE_OPTS);
      return reply.send({ user });
    } catch (err: unknown) {
      const e = err as Error & { statusCode?: number };
      return reply.status(e.statusCode ?? 500).send({ error: e.message });
    }
  });

  app.post('/auth/logout', async (_request, reply) => {
    reply.clearCookie('token', { path: '/' });
    return reply.send({ ok: true });
  });

  app.get('/auth/me', { preHandler: requireAuth }, async (request, reply) => {
    const user = await app.prisma.user.findUnique({
      where: { id: request.user.userId },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });
    if (!user) return reply.status(404).send({ error: 'Not found' });
    return reply.send({ user });
  });
}
