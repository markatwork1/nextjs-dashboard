import { expect } from 'chai';
import logoutHandler from '../../pages/api/logout';
import type { NextApiRequest, NextApiResponse } from 'next/types';
import { IncomingMessage, ServerResponse } from 'http';

function runHandler(handler: any, method: string) {
  return new Promise<{ res: any }>((resolve) => {
    const req = new IncomingMessage(null as any) as NextApiRequest;
    (req as any).method = method;
    const res = new ServerResponse(req) as unknown as NextApiResponse & { headers: Record<string,string>; _json?: any };
    (res as any).headers = {};
    (res as any).setHeader = (k: string, v: any) => { (res as any).headers[k] = v; };
    (res as any).status = (code: number) => { (res as any).statusCode = code; return res; };
    (res as any).json = (data: any) => { (res as any)._json = data; resolve({ res }); return res; };
    handler(req, res);
  });
}

describe('API Logout', () => {
  it('clears auth cookie', async () => {
    const { res } = await runHandler(logoutHandler, 'POST');
    expect(res.statusCode).to.equal(200);
    const json = (res as any)._json;
    expect(json).to.include({ message: 'Logged out', redirect: '/login' });
    const cookie = (res as any).headers['Set-Cookie'];
    expect(cookie).to.include('auth_token=;');
    expect(cookie).to.include('Max-Age=0');
  });
});
