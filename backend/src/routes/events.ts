import { FastifyInstance } from 'fastify';
import { requireAuth } from '../middleware/requireAuth';
import { getTaskListWithAccess } from '../services/taskLists';
import { subscribe } from '../services/events';

export async function eventRoutes(app: FastifyInstance) {
  app.get(
    '/task-lists/:id/events',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      await getTaskListWithAccess(app.prisma, id, request.user.userId);

      await reply.hijack();

      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      reply.raw.write(':connected\n\n');

      const heartbeat = setInterval(() => {
        try {
          reply.raw.write(':heartbeat\n\n');
        } catch {
          clearInterval(heartbeat);
          unsubscribe();
        }
      }, 30_000);

      const unsubscribe = subscribe(id, () => {
        try {
          reply.raw.write('data: update\n\n');
        } catch {
          clearInterval(heartbeat);
          unsubscribe();
        }
      });

      request.raw.on('close', () => {
        clearInterval(heartbeat);
        unsubscribe();
      });
    },
  );
}
