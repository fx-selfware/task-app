import { NextRequest, NextResponse } from 'next/server';
import { handle } from '@/lib/apiHandler';
import { requireAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { getTaskListVersion } from '@/lib/services/taskLists';

/**
 * Polled every few seconds by an open list. Returning an opaque token instead
 * of the list itself keeps an idle poll to one database round trip and a few
 * bytes; the client only refetches the list when this changes.
 */
export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const user = requireAuth(request);
    const db = await getDb();
    const version = await getTaskListVersion(db, id, user.userId);
    return NextResponse.json({ version });
  });
}
