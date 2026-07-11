import { NextRequest, NextResponse } from 'next/server';
import { handle, jsonError, readJson } from '@/lib/apiHandler';
import { authCookieOptions, signToken } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { loginUser } from '@/lib/services/auth';

export async function POST(request: NextRequest) {
  return handle(async () => {
    const { email, password } = (await readJson(request)) as { email?: string; password?: string };

    if (!email || !password) {
      return jsonError(400, 'email and password are required');
    }

    const user = await loginUser(getDb(), { email, password });
    const token = signToken(user.id, user.email, user.role);
    const response = NextResponse.json({ user });
    response.cookies.set('token', token, authCookieOptions());
    return response;
  });
}
