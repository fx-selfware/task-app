import { FastifyInstance } from 'fastify';
import { requireAuth } from '../middleware/requireAuth';
import { checkWriteAccess } from '../services/taskLists';
import { createTask, updateTask, deleteTask, reorderTasks, deleteCompletedTasks, deleteCompletedSubtasks } from '../services/tasks';
import { publish } from '../services/events';

export async function taskRoutes(app: FastifyInstance) {
  app.post(
    '/task-lists/:id/tasks',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as {
        title: string;
        description?: string;
        parentId?: string;
      };

      if (!body.title) return reply.status(400).send({ error: 'title is required' });

      await checkWriteAccess(app.prisma, id, request.user.userId);
      const task = await createTask(app.prisma, id, body);
      publish(id);
      return reply.status(201).send({ task });
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

      await checkWriteAccess(app.prisma, id, request.user.userId);
      const task = await updateTask(app.prisma, id, tid, body);
      publish(id);
      return reply.send({ task });
    },
  );

  app.delete(
    '/task-lists/:id/tasks/:tid',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id, tid } = request.params as { id: string; tid: string };

      await checkWriteAccess(app.prisma, id, request.user.userId);
      await deleteTask(app.prisma, id, tid);
      publish(id);
      return reply.status(204).send();
    },
  );

  app.delete(
    '/task-lists/:id/tasks/completed',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      await checkWriteAccess(app.prisma, id, request.user.userId);
      await deleteCompletedTasks(app.prisma, id);
      publish(id);
      return reply.status(204).send();
    },
  );

  app.delete(
    '/task-lists/:id/tasks/:tid/subtasks/completed',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id, tid } = request.params as { id: string; tid: string };

      await checkWriteAccess(app.prisma, id, request.user.userId);
      await deleteCompletedSubtasks(app.prisma, id, tid);
      publish(id);
      return reply.status(204).send();
    },
  );

  app.put(
    '/task-lists/:id/tasks/reorder',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { orderedIds, parentId } = request.body as {
        orderedIds: string[];
        parentId?: string | null;
      };

      if (!Array.isArray(orderedIds)) {
        return reply.status(400).send({ error: 'orderedIds must be an array' });
      }

      await checkWriteAccess(app.prisma, id, request.user.userId);
      await reorderTasks(app.prisma, id, orderedIds, parentId ?? null);
      publish(id);
      return reply.send({ ok: true });
    },
  );
}
