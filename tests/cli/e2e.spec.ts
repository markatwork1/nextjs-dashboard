import { test, expect, request } from '@playwright/test';

const seededUser = { email: 'user@nextmail.com', password: '123456' };

test.beforeAll(async () => {
  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
  try {
    await request.newContext().then((ctx) => ctx.get(base + '/app/seed'));
  } catch (e) {}
});

test('login and check dashboard pages titles', async ({ page }) => {
  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
  const testedPages: string[] = [];

  await test.step('Login via API and set auth cookie', async () => {
    const req = await request.newContext();
    const loginRes = await req.post(base + '/api/login', {
      data: { email: seededUser.email, password: seededUser.password, redirectTo: '/dashboard' },
    });
    expect(loginRes.ok()).toBeTruthy();
    const setCookieHeader = loginRes.headers()['set-cookie'] || loginRes.headers()['Set-Cookie'];
    expect(setCookieHeader).toBeTruthy();
    const cookieMatch = /auth_token=([^;]+)/.exec(setCookieHeader as string);
    expect(cookieMatch).toBeTruthy();
    const cookieValue = cookieMatch![1];
    await page.context().addCookies([
      {
        name: 'auth_token',
        value: cookieValue,
        domain: new URL(base).hostname,
        path: '/',
        httpOnly: true,
      },
    ]);
    console.log('\u2705 Logged in via API and set HttpOnly auth cookie in browser context');
  });

  await test.step('Check /login page title', async () => {
    await page.goto(base + '/login');
    await expect(page).toHaveTitle(/Login|Acme Dashboard/);
    testedPages.push('/login');
    console.log('Checked title for /login');
  });

  await test.step('Check /dashboard page title', async () => {
    await page.goto(base + '/dashboard');
    await expect(page).toHaveTitle(/Dashboard|Acme Dashboard/);
    testedPages.push('/dashboard');
    console.log('Checked title for /dashboard');
  });

  await test.step('Check /dashboard/customers page title', async () => {
    await page.goto(base + '/dashboard/customers');
    await expect(page).toHaveTitle(/Customers|Acme Dashboard/);
    testedPages.push('/dashboard/customers');
    console.log('Checked title for /dashboard/customers');
  });
});
