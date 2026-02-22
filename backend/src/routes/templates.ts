import { FastifyInstance } from 'fastify';
import { requireAuth } from '../middleware/requireAuth';
import {
  getTemplates,
  createTemplate,
  getTemplateByOwner,
  updateTemplate,
  deleteTemplate,
  createTemplateTask,
  updateTemplateTask,
  deleteTemplateTask,
  applyTemplate,
} from '../services/templates';

export async function templateRoutes(app: FastifyInstance) {
  app.get('/templates', { preHandler: requireAuth }, async (request, reply) => {
    const templates = await getTemplates(app.prisma, request.user.userId);
    return reply.send({ templates });
  });

  app.post('/templates', { preHandler: requireAuth }, async (request, reply) => {
    const { name } = request.body as { name: string };
    if (!name) return reply.status(400).send({ error: 'name is required' });

    try {
      const template = await createTemplate(app.prisma, request.user.userId, { name });
      return reply.status(201).send({ template });
    } catch (err: unknown) {
      const e = err as Error & { statusCode?: number };
      return reply.status(e.statusCode ?? 500).send({ error: e.message });
    }
  });

  app.get('/templates/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const template = await getTemplateByOwner(app.prisma, id, request.user.userId);
      return reply.send({ template });
    } catch (err: unknown) {
      const e = err as Error & { statusCode?: number };
      return reply.status(e.statusCode ?? 500).send({ error: e.message });
    }
  });

  app.patch('/templates/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { name } = request.body as { name: string };
    if (!name) return reply.status(400).send({ error: 'name is required' });

    try {
      const template = await updateTemplate(app.prisma, id, request.user.userId, name);
      return reply.send({ template });
    } catch (err: unknown) {
      const e = err as Error & { statusCode?: number };
      return reply.status(e.statusCode ?? 500).send({ error: e.message });
    }
  });

  app.delete('/templates/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await deleteTemplate(app.prisma, id, request.user.userId);
      return reply.status(204).send();
    } catch (err: unknown) {
      const e = err as Error & { statusCode?: number };
      return reply.status(e.statusCode ?? 500).send({ error: e.message });
    }
  });

  // Template tasks
  app.post(
    '/templates/:id/tasks',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { title, description } = request.body as {
        title: string;
        description?: string;
      };
      if (!title) return reply.status(400).send({ error: 'title is required' });

      try {
        const task = await createTemplateTask(app.prisma, id, request.user.userId, {
          title,
          description,
        });
        return reply.status(201).send({ task });
      } catch (err: unknown) {
        const e = err as Error & { statusCode?: number };
        return reply.status(e.statusCode ?? 500).send({ error: e.message });
      }
    },
  );

  app.patch(
    '/templates/:id/tasks/:tid',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id, tid } = request.params as { id: string; tid: string };
      const body = request.body as { title?: string; description?: string };

      try {
        const task = await updateTemplateTask(
          app.prisma,
          id,
          tid,
          request.user.userId,
          body,
        );
        return reply.send({ task });
      } catch (err: unknown) {
        const e = err as Error & { statusCode?: number };
        return reply.status(e.statusCode ?? 500).send({ error: e.message });
      }
    },
  );

  app.delete(
    '/templates/:id/tasks/:tid',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id, tid } = request.params as { id: string; tid: string };

      try {
        await deleteTemplateTask(app.prisma, id, tid, request.user.userId);
        return reply.status(204).send();
      } catch (err: unknown) {
        const e = err as Error & { statusCode?: number };
        return reply.status(e.statusCode ?? 500).send({ error: e.message });
      }
    },
  );

  app.post(
    '/templates/:id/apply',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { taskListId } = request.body as { taskListId: string };

      if (!taskListId) return reply.status(400).send({ error: 'taskListId is required' });

      try {
        const tasks = await applyTemplate(
          app.prisma,
          id,
          request.user.userId,
          taskListId,
          request.user.userId,
        );
        return reply.status(201).send({ tasks });
      } catch (err: unknown) {
        const e = err as Error & { statusCode?: number };
        return reply.status(e.statusCode ?? 500).send({ error: e.message });
      }
    },
  );
}
