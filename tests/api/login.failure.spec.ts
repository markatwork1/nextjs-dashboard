import { expect } from 'chai';
import bcrypt from 'bcryptjs';
import { setupTestDb } from './helpers/mongo';
import { ObjectId } from 'mongodb';
import type { NextApiRequest, NextApiResponse } from 'next/types';
import { IncomingMessage, ServerResponse } from 'http';

function runHandler(handler: any, method: string, body?: any) {
  return new Promise<{ res: any }>((resolve) => {
    const req = new IncomingMessage(null as any) as NextApiRequest;
    (req as any).method = method;
    (req as any).body = body;
    const res = new ServerResponse(req) as any;
    (res as any).headers = {};
    (res as any).setHeader = (k: string, v: any) => { (res as any).headers[k] = v; };
    (res as any).status = (code: number) => { (res as any).statusCode = code; return res; };
    (res as any).json = (data: any) => { (res as any)._json = data; resolve({ res: res as any }); return res; };
    handler(req, res);
  });
}

describe('API Login failure', () => {
  let close: () => Promise<void>;
  let loginHandler: any;
  before(async () => {
    const ctx = await setupTestDb();
    close = ctx.close;
    const hashed = await bcrypt.hash('123456', 10);
  await ctx.db.collection('users').insertOne({ _id: new ObjectId(), email: 'user@nextmail.com', password: hashed, name: 'User' });
    process.env.AUTH_SECRET = 'test_secret';
    loginHandler = (await import('../../pages/api/login')).default;
  });
  // Intentionally keep DB alive for subsequent login success test to reuse.
  // after(async () => { await close(); });

  it('401 for wrong password', async () => {
    const { res } = await runHandler(loginHandler, 'POST', { email: 'user@nextmail.com', password: 'badpass' });
    expect(res.statusCode).to.equal(401);
    expect((res as any)._json).to.include({ message: 'Invalid credentials.' });
  });

  it('400 for missing fields', async () => {
    const { res } = await runHandler(loginHandler, 'POST', { email: 'user@nextmail.com' });
    expect(res.statusCode).to.equal(400);
  });
});
