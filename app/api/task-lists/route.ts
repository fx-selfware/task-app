import { NextRequest, NextResponse } from 'next/server';
import { handle, jsonError, readJson } from '@/lib/apiHandler';
import { requireAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { createTaskList, getTaskLists } from '@/lib/services/taskLists';

export async function GET(request: NextRequest) {
  return handle(async () => {
    const user = requireAuth(request);
    const result = getTaskLists(getDb(), user.userId);
    return NextResponse.json(result);
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const user = requireAuth(request);
    const { name } = (await readJson(request)) as { name?: string };
    if (!name) return jsonError(400, 'name is required');

    const list = createTaskList(getDb(), user.userId, name);
    return NextResponse.json({ list }, { status: 201 });
  });
}
