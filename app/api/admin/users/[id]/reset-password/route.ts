import { NextRequest, NextResponse } from 'next/server';
import { handle, jsonError, readJson } from '@/lib/apiHandler';
import { requireAdmin } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { resetUserPassword } from '@/lib/services/admin';

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    requireAdmin(request);
    const { id } = await ctx.params;
    const { newPassword } = (await readJson(request)) as { newPassword?: string };

    if (!newPassword || newPassword.length < 8) {
      return jsonError(400, 'newPassword must be at least 8 characters');
    }

    await resetUserPassword(getDb(), id, newPassword);
    return NextResponse.json({ ok: true });
  });
}
