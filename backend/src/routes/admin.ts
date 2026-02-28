import { FastifyInstance } from 'fastify';
import { requireAuth } from '../middleware/requireAuth';
import { requireAdmin } from '../middleware/requireAdmin';
import { listUsers, resetUserPassword } from '../services/admin';

export async function adminRoutes(app: FastifyInstance) {
  app.get('/admin/users', { preHandler: [requireAuth, requireAdmin] }, async (_request, reply) => {
    const users = await listUsers(app.prisma);
    return reply.send({ users });
  });

  app.post(
    '/admin/users/:id/reset-password',
    { preHandler: [requireAuth, requireAdmin] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { newPassword } = request.body as { newPassword: string };

      if (!newPassword || newPassword.length < 8) {
        return reply.status(400).send({ error: 'newPassword must be at least 8 characters' });
      }

      await resetUserPassword(app.prisma, id, newPassword);
      return reply.send({ ok: true });
    },
  );
}
