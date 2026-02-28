import { FastifyInstance } from 'fastify';
import { Permission } from '@prisma/client';
import { requireAuth } from '../middleware/requireAuth';
import { getShares, createShare, updateShare, deleteShare } from '../services/shares';
import { publish } from '../services/events';

export async function shareRoutes(app: FastifyInstance) {
  app.get(
    '/task-lists/:id/shares',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        const shares = await getShares(app.prisma, id, request.user.userId);
        return reply.send({ shares });
      } catch (err: unknown) {
        const e = err as Error & { statusCode?: number };
        return reply.status(e.statusCode ?? 500).send({ error: e.message });
      }
    },
  );

  app.post(
    '/task-lists/:id/shares',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { email, permission } = request.body as {
        email: string;
        permission?: Permission;
      };

      if (!email) return reply.status(400).send({ error: 'email is required' });
      const perm: Permission = permission === 'WRITE' ? 'WRITE' : 'READ';

      try {
        const share = await createShare(app.prisma, id, request.user.userId, email, perm);
        publish(id, { type: 'tasks-changed', userId: request.user.userId });
        return reply.status(201).send({ share });
      } catch (err: unknown) {
        const e = err as Error & { statusCode?: number };
        return reply.status(e.statusCode ?? 500).send({ error: e.message });
      }
    },
  );

  app.patch(
    '/task-lists/:id/shares/:sid',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id, sid } = request.params as { id: string; sid: string };
      const { permission } = request.body as { permission: Permission };

      if (!permission) return reply.status(400).send({ error: 'permission is required' });

      try {
        const share = await updateShare(
          app.prisma,
          id,
          sid,
          request.user.userId,
          permission,
        );
        publish(id, { type: 'tasks-changed', userId: request.user.userId });
        return reply.send({ share });
      } catch (err: unknown) {
        const e = err as Error & { statusCode?: number };
        return reply.status(e.statusCode ?? 500).send({ error: e.message });
      }
    },
  );

  app.delete(
    '/task-lists/:id/shares/:sid',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id, sid } = request.params as { id: string; sid: string };

      try {
        await deleteShare(app.prisma, id, sid, request.user.userId);
        publish(id, { type: 'tasks-changed', userId: request.user.userId });
        return reply.status(204).send();
      } catch (err: unknown) {
        const e = err as Error & { statusCode?: number };
        return reply.status(e.statusCode ?? 500).send({ error: e.message });
      }
    },
  );
}
