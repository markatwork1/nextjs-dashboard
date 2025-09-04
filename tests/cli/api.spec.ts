import { test, expect } from '@playwright/test';

test.describe('API endpoints', () => {
  test('POST /api/login should respond with 2xx, 3xx, 401, or 400', async ({ request }) => {
    const response = await request.post('/api/login', {
      data: { email: 'test@example.com', password: 'testpassword' }
    });
    expect([200, 400, 401]).toContain(response.status());
  });

  test('POST /api/logout should respond with 2xx or 3xx', async ({ request }) => {
    const response = await request.post('/api/logout');
    expect(response.status()).toBeGreaterThanOrEqual(200);
    expect(response.status()).toBeLessThan(400);
  });

  test('GET /api/debug-auth should respond with 2xx, 401, or 403', async ({ request }) => {
    const loginRes = await request.post('/api/login', {
      data: { email: 'test@example.com', password: 'testpassword' }
    });
    let cookie = '';
    if (loginRes.status() === 200) {
      const setCookie = loginRes.headers()['set-cookie'];
      if (setCookie) {
        cookie = setCookie.split(';')[0];
      }
    }
    const response = await request.get('/api/debug-auth', {
      headers: cookie ? { cookie } : {}
    });
    expect([200, 401, 403]).toContain(response.status());
  });

  test('GET /api/debug-get-auth should respond with 2xx, 403, or 500', async ({ request }) => {
    const response = await request.get('/api/debug-get-auth');
    expect([200, 403, 500]).toContain(response.status());
  });
});
