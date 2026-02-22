import { FastifyInstance } from 'fastify';
import { requireAuth } from '../middleware/requireAuth';
import {
  getTaskLists,
  createTaskList,
  getTaskListWithAccess,
  updateTaskList,
  deleteTaskList,
} from '../services/taskLists';

export async function taskListRoutes(app: FastifyInstance) {
  app.get('/task-lists', { preHandler: requireAuth }, async (request, reply) => {
    const result = await getTaskLists(app.prisma, request.user.userId);
    return reply.send(result);
  });

  app.post('/task-lists', { preHandler: requireAuth }, async (request, reply) => {
    const { name } = request.body as { name: string };
    if (!name) return reply.status(400).send({ error: 'name is required' });

    const list = await createTaskList(app.prisma, request.user.userId, name);
    return reply.status(201).send({ list });
  });

  app.get('/task-lists/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const { list, isOwner, permission } = await getTaskListWithAccess(
        app.prisma,
        id,
        request.user.userId,
      );
      return reply.send({ list, isOwner, permission });
    } catch (err: unknown) {
      const e = err as Error & { statusCode?: number };
      return reply.status(e.statusCode ?? 500).send({ error: e.message });
    }
  });

  app.patch('/task-lists/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { name } = request.body as { name: string };
    if (!name) return reply.status(400).send({ error: 'name is required' });

    try {
      // Check ownership
      const existing = await app.prisma.taskList.findUnique({ where: { id } });
      if (!existing) return reply.status(404).send({ error: 'Not found' });
      if (existing.ownerId !== request.user.userId) {
        return reply.status(403).send({ error: 'Forbidden' });
      }
      const list = await updateTaskList(app.prisma, id, request.user.userId, name);
      return reply.send({ list });
    } catch (err: unknown) {
      const e = err as Error & { statusCode?: number };
      return reply.status(e.statusCode ?? 500).send({ error: e.message });
    }
  });

  app.delete('/task-lists/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      // Check ownership
      const existing = await app.prisma.taskList.findUnique({ where: { id } });
      if (!existing) return reply.status(404).send({ error: 'Not found' });
      if (existing.ownerId !== request.user.userId) {
        return reply.status(403).send({ error: 'Forbidden' });
      }
      await deleteTaskList(app.prisma, id, request.user.userId);
      return reply.status(204).send();
    } catch (err: unknown) {
      const e = err as Error & { statusCode?: number };
      return reply.status(e.statusCode ?? 500).send({ error: e.message });
    }
  });
}
