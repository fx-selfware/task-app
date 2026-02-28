import { FastifyInstance } from 'fastify';
import { Permission } from '@prisma/client';
import { requireAuth } from '../middleware/requireAuth';
import {
  getTemplateShares,
  createTemplateShare,
  updateTemplateShare,
  deleteTemplateShare,
} from '../services/template-shares';

export async function templateShareRoutes(app: FastifyInstance) {
  app.get(
    '/templates/:id/shares',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const shares = await getTemplateShares(app.prisma, id, request.user.userId);
      return reply.send({ shares });
    },
  );

  app.post(
    '/templates/:id/shares',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { email, permission } = request.body as {
        email: string;
        permission?: Permission;
      };

      if (!email) return reply.status(400).send({ error: 'email is required' });
      const perm: Permission = permission === 'WRITE' ? 'WRITE' : 'READ';

      const share = await createTemplateShare(
        app.prisma,
        id,
        request.user.userId,
        email,
        perm,
      );
      return reply.status(201).send({ share });
    },
  );

  app.patch(
    '/templates/:id/shares/:sid',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id, sid } = request.params as { id: string; sid: string };
      const { permission } = request.body as { permission: Permission };

      if (!permission) return reply.status(400).send({ error: 'permission is required' });

      const share = await updateTemplateShare(
        app.prisma,
        id,
        sid,
        request.user.userId,
        permission,
      );
      return reply.send({ share });
    },
  );

  app.delete(
    '/templates/:id/shares/:sid',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id, sid } = request.params as { id: string; sid: string };

      await deleteTemplateShare(app.prisma, id, sid, request.user.userId);
      return reply.status(204).send();
    },
  );
}
