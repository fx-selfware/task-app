import { NextResponse } from 'next/server';
import { HttpError } from '@/lib/httpError';

export function jsonError(statusCode: number, message: string) {
  return NextResponse.json({ error: message }, { status: statusCode });
}

/**
 * Port of the Fastify error handler in backend/src/server.ts:
 * HttpError -> its statusCode, anything else -> 500, body always {error: message}.
 */
export async function handle(fn: () => Promise<Response> | Response): Promise<Response> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonError(error.statusCode, error.message);
    }
    console.error(error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return jsonError(500, message);
  }
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
