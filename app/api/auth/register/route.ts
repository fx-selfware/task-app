import { NextRequest, NextResponse } from 'next/server';
import { handle, jsonError, readJson } from '@/lib/apiHandler';
import { authCookieOptions, signToken } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { registerUser } from '@/lib/services/auth';

export async function POST(request: NextRequest) {
  return handle(async () => {
    const { email, password, name } = (await readJson(request)) as {
      email?: string;
      password?: string;
      name?: string;
    };

    if (!email || !password || !name) {
      return jsonError(400, 'email, password, and name are required');
    }

    const user = await registerUser(await getDb(), { email, password, name });
    const token = signToken(user.id, user.email, user.role);
    const response = NextResponse.json({ user }, { status: 201 });
    response.cookies.set('token', token, authCookieOptions());
    return response;
  });
}
