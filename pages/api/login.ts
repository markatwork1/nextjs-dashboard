import type { NextApiRequest, NextApiResponse } from 'next/types';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || '';
const DB_NAME = process.env.MONGODB_DB || 'nextjs_dashboard';
const SECRET = process.env.AUTH_SECRET || 'dev_secret_key';
const COOKIE_NAME = 'auth_token';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // DEBUG instrumentation start
  // eslint-disable-next-line no-console
  console.log('[login api] start method=%s', req.method);
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }
  const { email, password } = req.body;
  // eslint-disable-next-line no-console
  console.log('[login api] body keys=%s', Object.keys(req.body || {}));
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }
  try {
    // eslint-disable-next-line no-console
  console.log('[login api] connecting to mongo uriLen=%s', MONGODB_URI.length);
    const client = await MongoClient.connect(MONGODB_URI);
    console.log('[login api] connected');
    const db = client.db(DB_NAME);
    const user = await db.collection('users').findOne({ email });
    console.log('[login api] user=%s', !!user);
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }
    const passwordMatch = await bcrypt.compare(password, user.password);
    console.log('[login api] passwordMatch=%s', passwordMatch);
    if (!passwordMatch) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }
    const token = jwt.sign({ email: user.email, name: user.name, _id: user._id.toString() }, SECRET, { expiresIn: '7d' });
    console.log('[login api] token signed');
    res.setHeader('Set-Cookie', `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`);
    return res.status(200).json({ message: 'Login successful', redirect: '/dashboard' });
  } catch (error) {
    console.log('[login api] error', error);
    return res.status(500).json({ message: 'Server error' });
  }
}
