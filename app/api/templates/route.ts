import { NextRequest, NextResponse } from 'next/server';
import { handle, jsonError, readJson } from '@/lib/apiHandler';
import { requireAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { createTemplate, getTemplates } from '@/lib/services/templates';

export async function GET(request: NextRequest) {
  return handle(async () => {
    const user = requireAuth(request);
    const db = await getDb();
    const { owned, shared } = await getTemplates(db, user.userId);
    return NextResponse.json({ owned, shared });
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const user = requireAuth(request);
    const { name } = (await readJson(request)) as { name?: string };
    if (!name) return jsonError(400, 'name is required');

    const db = await getDb();
    const template = await createTemplate(db, user.userId, { name });
    return NextResponse.json({ template }, { status: 201 });
  });
}
