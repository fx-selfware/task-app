import { NextRequest, NextResponse } from 'next/server';
import { handle, jsonError, readJson } from '@/lib/apiHandler';
import { requireAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { applyTemplate } from '@/lib/services/templates';

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const user = requireAuth(request);
    const { taskListId } = (await readJson(request)) as { taskListId?: string };

    if (!taskListId) return jsonError(400, 'taskListId is required');

    const tasks = applyTemplate(getDb(), id, taskListId, user.userId);
    return NextResponse.json({ tasks }, { status: 201 });
  });
}
