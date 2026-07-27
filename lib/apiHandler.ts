import { NextResponse } from 'next/server';
import { HttpError, httpError } from '@/lib/httpError';
import { withRoundTripHeader } from '@/lib/dbMetrics';

export function jsonError(statusCode: number, message: string) {
  return NextResponse.json({ error: message }, { status: statusCode });
}

/**
 * Port of the Fastify error handler in backend/src/server.ts:
 * HttpError -> its statusCode, body {error: message}; anything else -> logged
 * server-side and returned as a generic 500 {error: 'Internal Server Error'}
 * (the underlying message is never leaked to the client).
 */
export async function handle(fn: () => Promise<Response> | Response): Promise<Response> {
  return withRoundTripHeader(async () => {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof HttpError) {
        return jsonError(error.statusCode, error.message);
      }
      console.error(error);
      return jsonError(500, 'Internal Server Error');
    }
  });
}

/**
 * Body parser. A missing body is still {} — plenty of routes take none, and
 * those that need a field answer for themselves. A body that arrived damaged
 * is not the same thing though, and used to be flattened into {} as well; a
 * write cut off in transit then read as a well-formed request asking for
 * nothing, and got however far that took it. Say so instead.
 */
export async function readJson(request: Request): Promise<Record<string, unknown>> {
  let text: string;
  try {
    text = await request.text();
  } catch {
    // The connection went away mid-body. Nobody is left to read the response,
    // but this is a client-side truncation and shouldn't be logged as a crash.
    httpError(400, 'could not read request body');
  }

  if (text.trim() === '') return {};

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    httpError(400, 'invalid JSON body');
  }
  return typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
}
