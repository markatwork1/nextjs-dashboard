import { test, expect, Page } from '@playwright/test';

async function login(page: Page) {
  await page.goto('/login');
  await expect(page.locator('input[name="email"]')).toBeVisible();
  await expect(page.locator('input[name="password"]')).toBeVisible();
  await page.fill('input[name="email"]', 'user@nextmail.com');
  await page.fill('input[name="password"]', '123456');
  const loginButton = page.locator('form button');
  await expect(loginButton).toBeVisible();
  await loginButton.click();
  // Ensure we land on dashboard
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe('Visual regressions', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('Dashboard main content visual snapshot', async ({ page }) => {
    await page.goto('/dashboard');
    // Wait for overview content (cards + chart + latest invoices) to render
    await expect(page.getByRole('heading', { level: 1, name: /dashboard/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /recent revenue/i })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('heading', { name: /latest invoices/i })).toBeVisible();
    // Ensure at least one revenue bar is present (reduces skeleton flakiness)
    await expect(page.locator('.bg-blue-300').first()).toBeVisible();

    // Snapshot the main content area for visual regression
    await expect(page.locator('main')).toHaveScreenshot('dashboard-main.png', {
      maxDiffPixelRatio: 0.02,
      timeout: 20000,
    });
  });

  test('Invoices list visual snapshot', async ({ page }) => {
    await page.goto('/dashboard/invoices');
    await expect(page.getByRole('heading', { level: 1, name: /invoices/i })).toBeVisible();

    const table = page.locator('table');
    if (await table.isVisible()) {
      await expect(table).toHaveScreenshot('invoices-table.png', {
        maxDiffPixelRatio: 0.02,
        timeout: 20000,
      });
    } else {
      // Mobile layout: snapshot the mobile list container
      const mobileList = page.locator('.md:hidden');
      await expect(mobileList).toBeVisible();
      await expect(mobileList).toHaveScreenshot('invoices-mobile-list.png', {
        maxDiffPixelRatio: 0.02,
        timeout: 20000,
      });
    }
  });
});
