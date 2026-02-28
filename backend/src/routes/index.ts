import { FastifyInstance } from 'fastify';
import { authRoutes } from './auth';
import { taskListRoutes } from './taskLists';
import { taskRoutes } from './tasks';
import { shareRoutes } from './shares';
import { templateRoutes } from './templates';
import { eventRoutes } from './events';

export async function registerRoutes(app: FastifyInstance) {
  await app.register(authRoutes);
  await app.register(taskListRoutes);
  await app.register(taskRoutes);
  await app.register(shareRoutes);
  await app.register(templateRoutes);
  await app.register(eventRoutes);
}
