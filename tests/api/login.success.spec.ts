import { expect } from 'chai';
import { setupTestDb } from './helpers/mongo';
import bcrypt from 'bcryptjs';
import { ObjectId } from 'mongodb';
import type { NextApiRequest } from 'next/types';
import { IncomingMessage, ServerResponse } from 'http';

function runHandler(handler: any, method: string, body?: any) {
  return new Promise<{ res: any }>((resolve, reject) => {
    try {
      if (typeof handler !== 'function') {
        return reject(new Error('Handler is not a function'));
      }
      const req = new IncomingMessage(null as any) as NextApiRequest;
      (req as any).method = method;
      (req as any).body = body;
      const res = new ServerResponse(req) as any;
      (res as any).headers = {};
      (res as any).setHeader = (k: string, v: any) => { (res as any).headers[k] = v; };
      (res as any).status = (code: number) => { (res as any).statusCode = code; return res; };
      (res as any).json = (data: any) => { (res as any)._json = data; resolve({ res: res as any }); return res; };
      const maybe = handler(req, res);
      if (maybe && typeof maybe.then === 'function') {
        maybe.catch((e: any) => reject(e));
      }
      // Safety timer so we can see if handler never calls res.json
      setTimeout(() => {
        if (!(res as any)._json) {
          reject(new Error('Handler did not respond within 5000ms'));
        }
      }, 5000).unref();
    } catch (err) {
      reject(err);
    }
  });
}

describe('API Login success', () => {
  let close: () => Promise<void>;
  const password = '123456';
  let loginHandler: any;

  before(async () => {
    let db: any;
    if (process.env.MONGODB_URI) {
      // Reuse existing memory server from previous login failure tests.
      const { MongoClient } = require('mongodb');
      const client = await MongoClient.connect(process.env.MONGODB_URI);
      db = client.db(process.env.MONGODB_DB || 'testdb');
      close = async () => { await client.close(); };
    } else {
      const ctx = await setupTestDb();
      close = ctx.close;
      db = ctx.db;
    }
    const existing = await db.collection('users').findOne({ email: 'user@nextmail.com' });
    if (!existing) {
      const hashed = await bcrypt.hash(password, 10);
      await db.collection('users').insertOne({ _id: new ObjectId(), email: 'user@nextmail.com', password: hashed, name: 'User' });
    }
    process.env.AUTH_SECRET = 'test_secret';
    loginHandler = (await import('../../pages/api/login')).default;
  });

  after(async () => {
    await close();
  });

  it('returns 200, sets cookie and redirect', async () => {
    if (!loginHandler) {
      loginHandler = (await import('../../pages/api/login')).default;
    }
    const { res } = await runHandler(loginHandler, 'POST', { email: 'user@nextmail.com', password });
    expect(res.statusCode).to.equal(200);
    const json = (res as any)._json;
    expect(json).to.include({ message: 'Login successful', redirect: '/dashboard' });
    const setCookie = (res as any).headers['Set-Cookie'];
    expect(setCookie).to.be.a('string');
    expect(setCookie).to.include('auth_token=');
  });
});
