import { cookies, headers } from 'next/headers';
import jwt from 'jsonwebtoken';

// For Next.js 15+, cookies() returns a RequestCookies object directly in server actions and API routes

// cookies() returns a RequestCookies object in server actions and API routes (not a promise)
// Do not use await or treat as a promise

const SECRET = process.env.AUTH_SECRET || 'dev_secret_key';
const COOKIE_NAME = 'auth_token';

export async function setAuthCookie(user: { email: string; name: string; _id: string }) {
  const token = jwt.sign({ email: user.email, name: user.name, _id: user._id }, SECRET, { expiresIn: '7d' });
  const cookieStore = await cookies();
  // expire in 7 days
  const expires = new Date();
  expires.setDate(expires.getDate() + 7);
  // Only set secure in production so local dev over http works
  const secure = process.env.NODE_ENV === 'production';
  cookieStore.set(COOKIE_NAME, token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure,
    expires,
  });
  if (process.env.NODE_ENV !== 'production') {
    // lightweight server-side debug to confirm cookie set flow (no secrets)
    // eslint-disable-next-line no-console
    console.log(`[auth] setAuthCookie for: ${user.email}`);
  }
}

export async function clearAuthCookie() {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, '', { path: '/', httpOnly: true, expires: new Date(0) });
}

export async function getAuthUser() {
  const cookieStore = await cookies();
  let token = cookieStore.get(COOKIE_NAME)?.value;

  // Fallback: some server contexts may not expose cookies() as expected; try raw header
  if (!token) {
    const cookieHeader = (await headers()).get('cookie') || '';
    const found = cookieHeader
      .split(';')
      .map((c: string) => c.trim())
      .find((c: string) => c.startsWith(`${COOKIE_NAME}=`));
    if (found) token = found.split('=')[1];
  }

  if (!token) return null;
  try {
    const payload = jwt.verify(token, SECRET);
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.log('[auth] getAuthUser OK:', (payload as any).email || '(no email)');
    }
    return payload as any;
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.log('[auth] token verification failed', String(err));
    }
    return null;
  }
}
