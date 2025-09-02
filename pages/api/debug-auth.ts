import type { NextApiRequest, NextApiResponse } from 'next/types';
import jwt from 'jsonwebtoken';

const SECRET = process.env.AUTH_SECRET || 'dev_secret_key';
const COOKIE_NAME = 'auth_token';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only enable in non-production for safety
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ ok: false, message: 'disabled in production' });
  }

  const cookieHeader = req.headers.cookie || '';
  const cookie = cookieHeader
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE_NAME}=`));

  if (!cookie) {
    return res.status(401).json({ ok: false, message: 'no auth cookie present' });
  }

  const token = cookie.split('=')[1];
  if (!token) return res.status(401).json({ ok: false, message: 'empty token' });

  try {
    const payload = jwt.verify(token, SECRET);
    return res.status(200).json({ ok: true, payload });
  } catch (err: any) {
    return res.status(401).json({ ok: false, message: 'token verification failed', error: String(err) });
  }
}
