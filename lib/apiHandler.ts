import { NextResponse } from 'next/server';
import { HttpError } from '@/lib/httpError';
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

/** Body parser matching Fastify's tolerance: invalid/missing JSON becomes {}. */
export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    return typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
