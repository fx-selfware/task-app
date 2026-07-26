import { NextRequest, NextResponse } from 'next/server';
import { handle, jsonError, readJson } from '@/lib/apiHandler';
import { requireAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { createTask } from '@/lib/services/tasks';

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const user = requireAuth(request);
    const { title, description, parentId } = (await readJson(request)) as {
      title?: string;
      description?: string;
      parentId?: string;
    };

    if (!title) return jsonError(400, 'title is required');

    const db = await getDb();
    const task = await createTask(db, id, user.userId, { title, description, parentId });
    return NextResponse.json({ task }, { status: 201 });
  });
}
