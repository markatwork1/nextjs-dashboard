import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SECRET = process.env.AUTH_SECRET || 'dev_secret_key';

function base64UrlToUint8Array(base64Url: string): Uint8Array {
  let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4;
  if (pad) base64 += '='.repeat(4 - pad);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function verifyJwtHS256(token: string, secret: string): Promise<{ valid: boolean; payload?: any }> {
  const parts = token.split('.');
  if (parts.length !== 3) return { valid: false };
  const [headerB64, payloadB64, sigB64] = parts;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );
  const dataBytes = enc.encode(`${headerB64}.${payloadB64}`);
  const signatureBytes = base64UrlToUint8Array(sigB64);
  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    signatureBytes as unknown as BufferSource,
    dataBytes as unknown as BufferSource
  );
  if (!valid) return { valid: false };
  // Decode payload for optional logging
  const payloadJson = new TextDecoder().decode(base64UrlToUint8Array(payloadB64));
  try {
    return { valid: true, payload: JSON.parse(payloadJson) };
  } catch {
    return { valid: true };
  }
}

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
      const { valid, payload } = await verifyJwtHS256(token, SECRET);
      if (!valid) throw new Error('invalid signature');
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.log('[middleware] jwt verified', (payload as any)?.email || '(no email)');
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