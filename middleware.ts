import { NextResponse, type NextRequest } from 'next/server';

/**
 * Turns away visitors with no session cookie before any JavaScript loads, so
 * AuthGuard no longer has to block the whole app on /api/auth/me — the page's
 * own queries can start in parallel with it instead of after it.
 *
 * This checks for the cookie's presence, nothing more. Every API route still
 * verifies the token itself (requireAuth in lib/auth.ts), which is what
 * actually protects the data; a forged cookie gets an empty shell and 401s.
 */
export function middleware(request: NextRequest) {
  if (request.cookies.has('token')) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/task-lists/:path*', '/templates/:path*', '/admin/:path*'],
};
