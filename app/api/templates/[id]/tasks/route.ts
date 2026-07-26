import { NextRequest, NextResponse } from 'next/server';
import { handle, jsonError, readJson } from '@/lib/apiHandler';
import { requireAuth } from '@/lib/auth';
import { parseClientId } from '@/lib/ids';
import { getDb } from '@/lib/db';
import { createTemplateTask } from '@/lib/services/templates';

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const user = requireAuth(request);
    const body = (await readJson(request)) as {
      id?: unknown;
      title?: string;
      description?: string;
      parentId?: string;
    };
    const { title, description, parentId } = body;

    if (!title) return jsonError(400, 'title is required');

    const db = await getDb();
    const task = await createTemplateTask(db, id, user.userId, {
      id: parseClientId(body.id),
      title,
      description,
      parentId,
    });
    return NextResponse.json({ task }, { status: 201 });
  });
}
