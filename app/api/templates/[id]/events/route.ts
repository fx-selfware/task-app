import { NextRequest } from 'next/server';
import { handle } from '@/lib/apiHandler';
import { requireAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { getTemplateWithAccess } from '@/lib/services/templates';
import { subscribe } from '@/lib/events';

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const user = requireAuth(request);
    getTemplateWithAccess(getDb(), id, user.userId); // access check, throws 404 like the old preamble

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        let cleanup: () => void;

        const send = (chunk: string) => {
          try {
            controller.enqueue(encoder.encode(chunk));
          } catch {
            cleanup();
          }
        };

        controller.enqueue(encoder.encode(':connected\n\n'));

        const heartbeat = setInterval(() => send(':heartbeat\n\n'), 30_000);
        const unsubscribe = subscribe(`template:${id}`, () => send('data: update\n\n'));

        cleanup = () => {
          clearInterval(heartbeat);
          unsubscribe();
          try {
            controller.close();
          } catch {
            // already closed
          }
        };

        request.signal.addEventListener('abort', cleanup);
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  });
}
