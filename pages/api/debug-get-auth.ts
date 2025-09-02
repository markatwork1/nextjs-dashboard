import type { NextApiRequest, NextApiResponse } from 'next/types';
import { getAuthUser } from '@/app/lib/auth-session';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ ok: false, message: 'disabled in production' });
  }
  try {
    const user = await getAuthUser();
    return res.status(200).json({ ok: true, user });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
}
