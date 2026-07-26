import { NextRequest, NextResponse } from 'next/server';
import { handle, jsonError, readJson } from '@/lib/apiHandler';
import { requireAuth } from '@/lib/auth';
import { parseClientId } from '@/lib/ids';
import { getDb } from '@/lib/db';
import { createTaskList, getTaskLists } from '@/lib/services/taskLists';

export async function GET(request: NextRequest) {
  return handle(async () => {
    const user = requireAuth(request);
    const db = await getDb();
    const result = await getTaskLists(db, user.userId);
    return NextResponse.json(result);
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const user = requireAuth(request);
    const body = (await readJson(request)) as { name?: string; id?: unknown };
    if (!body.name) return jsonError(400, 'name is required');

    const db = await getDb();
    const list = await createTaskList(db, user.userId, body.name, parseClientId(body.id));
    return NextResponse.json({ list }, { status: 201 });
  });
}
