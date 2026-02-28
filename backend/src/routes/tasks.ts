import { FastifyInstance } from 'fastify';
import { requireAuth } from '../middleware/requireAuth';
import { getTaskListWithAccess } from '../services/taskLists';
import { createTask, updateTask, deleteTask, reorderTasks, deleteCompletedTasks } from '../services/tasks';
import { publish } from '../services/events';

async function getWriteAccess(
  app: FastifyInstance,
  listId: string,
  userId: string,
  reply: any,
): Promise<boolean> {
  try {
    const { permission } = await getTaskListWithAccess(app.prisma, listId, userId);
    if (permission !== 'WRITE') {
      reply.status(403).send({ error: 'Forbidden' });
      return false;
    }
    return true;
  } catch (err: unknown) {
    const e = err as Error & { statusCode?: number };
    reply.status(e.statusCode ?? 500).send({ error: e.message });
    return false;
  }
}

export async function taskRoutes(app: FastifyInstance) {
  app.post(
    '/task-lists/:id/tasks',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as {
        title: string;
        description?: string;
      };

      if (!body.title) return reply.status(400).send({ error: 'title is required' });

      if (!(await getWriteAccess(app, id, request.user.userId, reply))) return;

      try {
        const task = await createTask(app.prisma, id, body);
        publish(id, { type: 'tasks-changed', userId: request.user.userId });
        return reply.status(201).send({ task });
      } catch (err: unknown) {
        const e = err as Error & { statusCode?: number };
        return reply.status(e.statusCode ?? 500).send({ error: e.message });
      }
    },
  );

  app.patch(
    '/task-lists/:id/tasks/:tid',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id, tid } = request.params as { id: string; tid: string };
      const body = request.body as {
        title?: string;
        description?: string;
        status?: 'TODO' | 'DONE';
      };

      if (!(await getWriteAccess(app, id, request.user.userId, reply))) return;

      try {
        const task = await updateTask(app.prisma, id, tid, body);
        publish(id, { type: 'tasks-changed', userId: request.user.userId });
        return reply.send({ task });
      } catch (err: unknown) {
        const e = err as Error & { statusCode?: number };
        return reply.status(e.statusCode ?? 500).send({ error: e.message });
      }
    },
  );

  app.delete(
    '/task-lists/:id/tasks/:tid',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id, tid } = request.params as { id: string; tid: string };

      if (!(await getWriteAccess(app, id, request.user.userId, reply))) return;

      try {
        await deleteTask(app.prisma, id, tid);
        publish(id, { type: 'tasks-changed', userId: request.user.userId });
        return reply.status(204).send();
      } catch (err: unknown) {
        const e = err as Error & { statusCode?: number };
        return reply.status(e.statusCode ?? 500).send({ error: e.message });
      }
    },
  );

  app.delete(
    '/task-lists/:id/tasks/completed',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      if (!(await getWriteAccess(app, id, request.user.userId, reply))) return;

      try {
        await deleteCompletedTasks(app.prisma, id);
        publish(id, { type: 'tasks-changed', userId: request.user.userId });
        return reply.status(204).send();
      } catch (err: unknown) {
        const e = err as Error & { statusCode?: number };
        return reply.status(e.statusCode ?? 500).send({ error: e.message });
      }
    },
  );

  app.put(
    '/task-lists/:id/tasks/reorder',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { orderedIds } = request.body as { orderedIds: string[] };

      if (!Array.isArray(orderedIds)) {
        return reply.status(400).send({ error: 'orderedIds must be an array' });
      }

      if (!(await getWriteAccess(app, id, request.user.userId, reply))) return;

      try {
        await reorderTasks(app.prisma, id, orderedIds);
        publish(id, { type: 'tasks-changed', userId: request.user.userId });
        return reply.send({ ok: true });
      } catch (err: unknown) {
        const e = err as Error & { statusCode?: number };
        return reply.status(e.statusCode ?? 500).send({ error: e.message });
      }
    },
  );
}
