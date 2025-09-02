import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const SECRET = process.env.AUTH_SECRET || 'dev_secret_key';

// Middleware verifies the HMAC-signed JWT in the auth_token cookie (edge-safe)
export async function middleware(req: NextRequest) {
  const token = req.cookies.get('auth_token')?.value;
  if (req.nextUrl.pathname.startsWith('/dashboard')) {
    if (!token) {
      const url = req.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('callbackUrl', req.nextUrl.pathname);
      return NextResponse.redirect(url);
    }
    try {
      const key = new TextEncoder().encode(SECRET);
      const { payload } = await jwtVerify(token, key);
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.log('[middleware] jwt verified', (payload as any).email || '(no email)');
      }
      return NextResponse.next();
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.log('[middleware] jwt verification failed', String(err));
      }
      const url = req.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('callbackUrl', req.nextUrl.pathname);
      return NextResponse.redirect(url);
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*'],
};