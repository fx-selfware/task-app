import { FastifyInstance } from 'fastify';
import { requireAuth } from '../middleware/requireAuth';
import {
  getTaskLists,
  createTaskList,
  getTaskListWithAccess,
  updateTaskList,
  deleteTaskList,
} from '../services/taskLists';
import { publish } from '../services/events';

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
    const { list, isOwner, permission } = await getTaskListWithAccess(
      app.prisma,
      id,
      request.user.userId,
    );
    return reply.send({ list, isOwner, permission });
  });

  app.patch('/task-lists/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { name } = request.body as { name: string };
    if (!name) return reply.status(400).send({ error: 'name is required' });

    const list = await updateTaskList(app.prisma, id, request.user.userId, name);
    publish(id);
    return reply.send({ list });
  });

  app.delete('/task-lists/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await deleteTaskList(app.prisma, id, request.user.userId);
    publish(id);
    return reply.status(204).send();
  });
}
