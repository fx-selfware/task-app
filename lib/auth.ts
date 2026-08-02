import jwt from 'jsonwebtoken';
import type { NextRequest } from 'next/server';
import { getConfig } from '@/lib/config';
import { httpError } from '@/lib/httpError';

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

const COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

export function signToken(userId: string, email: string, role: string): string {
  return jwt.sign({ userId, email, role }, getConfig().JWT_SECRET, { expiresIn: '7d' });
}

export function authCookieOptions() {
  return {
    httpOnly: true,
    // Lax, not Strict: Chrome treats a home-screen PWA launch as a navigation
    // from an external app and withholds Strict cookies on it, so every cold
    // launch of the installed app bounced through middleware.ts to /login.
    // Lax still keeps the cookie off cross-site non-GET requests, which is
    // every mutation in this API.
    sameSite: 'lax' as const,
    secure: getConfig().COOKIE_SECURE,
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  };
}

export function getAuthUser(request: NextRequest): JwtPayload | null {
  const token = request.cookies.get('token')?.value;
  if (!token) return null;
  try {
    return jwt.verify(token, getConfig().JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

/** Port of middleware/requireAuth: 401 {error:'Unauthorized'} when missing/invalid. */
export function requireAuth(request: NextRequest): JwtPayload {
  const user = getAuthUser(request);
  if (!user) httpError(401, 'Unauthorized');
  return user;
}

/** Port of middleware/requireAdmin: 403 {error:'Forbidden'} for non-admins. */
export function requireAdmin(request: NextRequest): JwtPayload {
  const user = requireAuth(request);
  if (user.role !== 'ADMIN') httpError(403, 'Forbidden');
  return user;
}
