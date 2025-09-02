import type { NextApiRequest, NextApiResponse } from 'next/types';

const COOKIE_NAME = 'auth_token';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  return res.status(200).json({ message: 'Logged out', redirect: '/login' });
}
