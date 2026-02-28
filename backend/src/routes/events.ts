import { FastifyInstance } from 'fastify';
import { requireAuth } from '../middleware/requireAuth';
import { getTaskListWithAccess } from '../services/taskLists';
import { subscribe, TaskListEvent } from '../services/events';

export async function eventRoutes(app: FastifyInstance) {
  app.get(
    '/task-lists/:id/events',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      try {
        await getTaskListWithAccess(app.prisma, id, request.user.userId);
      } catch (err: unknown) {
        const e = err as Error & { statusCode?: number };
        return reply.status(e.statusCode ?? 500).send({ error: e.message });
      }

      // Hijack first to prevent Fastify from managing the response
      await reply.hijack();

      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      reply.raw.write(':connected\n\n');

      const unsubscribe = subscribe(id, (event: TaskListEvent) => {
        try {
          reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
        } catch {
          // Client already disconnected
        }
      });

      const heartbeat = setInterval(() => {
        try {
          reply.raw.write(':heartbeat\n\n');
        } catch {
          // Client already disconnected
        }
      }, 30_000);

      request.raw.on('close', () => {
        clearInterval(heartbeat);
        unsubscribe();
      });
    },
  );
}
